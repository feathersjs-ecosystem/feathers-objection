import Proto from 'uberproto'
import filter from 'feathers-query-filters'
import isPlainObject from 'is-plain-object'
import errorHandler from './error-handler'
import { errors } from 'feathers-errors'

const METHODS = {
  $or: 'orWhere',
  $ne: 'whereNot',
  $in: 'whereIn',
  $nin: 'whereNotIn'
}

const OPERATORS = {
  $lt: '<',
  $lte: '<=',
  $gt: '>',
  $gte: '>=',
  $like: 'like'
}

/**
 * Class representing an feathers adapter for objection.js ORM.
 * @param {object} options
 * @param {string} [id='id'] - database id field
 * @param {object} options.model - an objection model
 * @param {object} [options.paginate]
 * @param {string} [allowedEager] - Objection eager loading string.
 */
class Service {
  constructor (options) {
    if (!options) {
      throw new Error('Objection options have to be provided')
    }

    if (!options.model) {
      throw new Error('You must provide an Objection Model')
    }

    this.options = options || {}
    this.id = options.id || 'id'
    this.paginate = options.paginate || {}
    this.events = options.events || []
    this.Model = options.model
    this.allowedEager = options.allowedEager || '[]'
    this.namedEagerFilters = options.namedEagerFilters
    this.eagerFilters = options.eagerFilters
  }

  extend (obj) {
    return Proto.extend(obj, this)
  }

  /**
   * Maps a feathers query to the objection/knex schema builder functions.
   * @param query - a query object. i.e. { type: 'fish', age: { $lte: 5 }
   * @param params
   * @param parentKey
   */
  objectify (query, params, parentKey) {
    Object.keys(params || {}).forEach(key => {
      const value = params[key]

      if (isPlainObject(value)) {
        return this.objectify(query, value, key)
      }

      const column = parentKey || key
      const method = METHODS[key]
      const operator = OPERATORS[key] || '='

      if (method) {
        if (key === '$or') {
          const self = this

          return value.forEach(condition => {
            query[method](function () {
              self.objectify(this, condition)
            })
          })
        }

        return query[method].call(query, column, value) // eslint-disable-line no-useless-call
      }

      return query.where(column, operator, value)
    })
  }

  createQuery (paramsQuery = {}) {
    const { filters, query } = filter(paramsQuery)
    let q = this.Model.query()
      .skipUndefined()
      .allowEager(this.allowedEager)

    // $eager for objection eager queries
    let $eager
    let $joinEager

    if (query && query.$eager) {
      $eager = query.$eager
      delete query.$eager
      q.eager($eager, this.namedEagerFilters)
    }

    if (query && query.$joinEager) {
      $joinEager = query.$joinEager
      delete query.$joinEager
      q
        .eagerAlgorithm(this.Model.JoinEagerAlgorithm)
        .eager($joinEager, this.namedEagerFilters)
    }

    // $select uses a specific find syntax, so it has to come first.
    if (filters.$select) {
      q = this.Model.query()
        .skipUndefined()
        .allowEager(this.allowedEager)
        .select(...filters.$select.concat(this.id))
      if ($eager) {
        q.eager($eager, this.namedEagerFilters)
      } else if ($joinEager) {
        q
          .eagerAlgorithm(this.Model.JoinEagerAlgorithm)
          .eager($joinEager, this.namedEagerFilters)
      }

      // .joinEager($joinEager, this.namedEagerFilters)
    }

    // apply eager filters if specified
    if (this.eagerFilters) {
      const eagerFilters = this.eagerFilters
      if (Array.isArray(eagerFilters)) {
        for (var eagerFilter of eagerFilters) {
          q.filterEager(eagerFilter.expression, eagerFilter.filter)
        }
      } else {
        q.filterEager(eagerFilters.expression, eagerFilters.filter)
      }
    }

    // build up the knex query out of the query params
    this.objectify(q, query)

    if (filters.$sort) {
      Object.keys(filters.$sort).forEach(key => {
        q = q.orderBy(key, filters.$sort[key] === 1 ? 'asc' : 'desc')
      })
    }

    return q
  }

  _find (params, count, getFilter = filter) {
    const { filters, query } = getFilter(params.query || {})
    const q = params.objection || this.createQuery(params.query)

    // Handle $limit
    if (filters.$limit) {
      q.limit(filters.$limit)
    }

    // Handle $skip
    if (filters.$skip) {
      q.offset(filters.$skip)
    }

    let executeQuery = total => {
      return q.then(data => {
        return {
          total,
          limit: filters.$limit,
          skip: filters.$skip || 0,
          data
        }
      })
    }

    if (filters.$limit === 0) {
      executeQuery = total => {
        return Promise.resolve({
          total,
          limit: filters.$limit,
          skip: filters.$skip || 0,
          data: []
        })
      }
    }

    if (count) {
      let countQuery = this.Model.query()
        .skipUndefined()
        .count(`${this.id} as total`)

      this.objectify(countQuery, query)

      return countQuery
        .then(count => parseInt(count[0].total, 10))
        .then(executeQuery)
    }

    return executeQuery().catch(errorHandler)
  }

  /**
   * `find` service function for objection.
   * @param params
   */
  find (params) {
    const paginate =
      params && typeof params.paginate !== 'undefined'
        ? params.paginate
        : this.paginate
    const result = this._find(params, !!paginate.default, query =>
      filter(query, paginate)
    )

    if (!paginate.default) {
      return result.then(page => page.data)
    }

    return result
  }

  _get (id, params) {
    const query = Object.assign({}, params.query)
    query[this.id] = id

    return this._find(Object.assign({}, params, { query }))
      .then(page => {
        if (page.data.length !== 1) {
          throw new errors.NotFound(`No record found for id '${id}'`)
        }

        return page.data[0]
      })
      .catch(errorHandler)
  }

  /**
   * `get` service function for objection.
   * @param {...object} args
   * @return {Promise} - promise containing the data being retrieved
   */
  get (...args) {
    return this._get(...args)
  }

  _create (data, params) {
    return this.Model.query()
      .insert(data, this.id)
      .then(row => {
        const id =
          typeof data[this.id] !== 'undefined' ? data[this.id] : row[this.id]
        return this._get(id, params)
      })
      .catch(errorHandler)
  }

  /**
   * `create` service function for objection.
   * @param {object} data
   * @param {object} params
   */
  create (data, params) {
    if (Array.isArray(data)) {
      return Promise.all(data.map(current => this._create(current, params)))
    }

    return this._create(data, params)
  }

  /**
   * `update` service function for objection.
   * @param id
   * @param data
   * @param params
   */
  update (id, data, params) {
    if (Array.isArray(data)) {
      return Promise.reject(
        'Not replacing multiple records. Did you mean `patch`?'
      )
    }

    // NOTE (EK): First fetch the old record so
    // that we can fill any existing keys that the
    // client isn't updating with null;
    return this._get(id, params)
      .then(oldData => {
        let newObject = {}

        for (var key of Object.keys(oldData)) {
          if (data[key] === undefined) {
            newObject[key] = null
          } else {
            newObject[key] = data[key]
          }
        }

        // NOTE (EK): Delete id field so we don't update it
        delete newObject[this.id]

        return this.Model.query()
          .where(this.id, id)
          .update(newObject)
          .then(() => {
            // NOTE (EK): Restore the id field so we can return it to the client
            newObject[this.id] = id
            return newObject
          })
      })
      .catch(errorHandler)
  }

  /**
   * `patch` service function for objection.
   * @param id
   * @param data
   * @param params
   */
  patch (id, raw, params) {
    const query = filter(params.query || {}).query
    const data = Object.assign({}, raw)

    const mapIds = page => page.data.map(current => current[this.id])

    // By default we will just query for the one id. For multi patch
    // we create a list of the ids of all items that will be changed
    // to re-query them after the update
    const ids =
      id === null ? this._find(params).then(mapIds) : Promise.resolve([id])

    if (id !== null) {
      query[this.id] = id
    }

    let q = this.Model.query()

    this.objectify(q, query)

    delete data[this.id]

    return ids
      .then(idList => {
        // Create a new query that re-queries all ids that
        // were originally changed
        const findParams = Object.assign({}, params, {
          query: {
            [this.id]: { $in: idList },
            $select: params.query && params.query.$select
          }
        })

        return q.patch(data).then(() => {
          return this._find(findParams).then(page => {
            const items = page.data

            if (id !== null) {
              if (items.length === 1) {
                return items[0]
              } else {
                throw new errors.NotFound(`No record found for id '${id}'`)
              }
            }

            return items
          })
        })
      })
      .catch(errorHandler)
  }

  /**
   * `remove` service function for objection.
   * @param id
   * @param params
   */
  remove (id, params) {
    params.query = params.query || {}

    // NOTE (EK): First fetch the record so that we can return
    // it when we delete it.
    if (id !== null) {
      params.query[this.id] = id
    }

    return this._find(params)
      .then(page => {
        const items = page.data
        const query = this.Model.query()

        this.objectify(query, params.query)

        return query.delete().then(() => {
          if (id !== null) {
            if (items.length === 1) {
              return items[0]
            } else {
              throw new errors.NotFound(`No record found for id '${id}'`)
            }
          }

          return items
        })
      })
      .catch(errorHandler)
  }
}

export default function init (options) {
  return new Service(options)
}

init.Service = Service
