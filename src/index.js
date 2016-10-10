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
  $gte: '>='
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
   * get this service's model
   * @return {object} the service's model
   */
  get model () {
    return this.Model
  }

  /**
   * Maps a feathers query to the objection/knex schema builder functions.
   * @param query - a query object. i.e. { type: 'fish', age: { $lte: 5 }
   * @param params
   * @param parentKey
   */
  objectify (query, params, parentKey) {
    Object.keys(params || {}).forEach((key) => {
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

  _find (params, count, getFilter = filter) {
    let q = this.Model.query()
      .allowEager(this.allowedEager)

    // $eager for objection eager queries
    let $eager
    if (params.query && params.query.$eager) {
      $eager = params.query.$eager
      delete params.query.$eager
    }
    q.eager($eager, this.namedEagerFilters)

    const { filters, query } = getFilter(params.query || {})

    // $select uses a specific find syntax, so it has to come first.
    if (filters.$select) {
      let fields = filters.$select
      q = this.Model.query()
        .allowEager(this.allowedEager)
        .select(...fields)
        .eager($eager, this.namedEagerFilters)
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
        // Note that even though column names are mapped when fetching
        // / storing data, one still has to use correct db column names when
        // writing queries
        q.orderBy(key, parseInt(filters.$sort[key], 10) === 1 ? 'asc' : 'desc')
      })
    }
    // Handle $limit
    if (filters.$limit) {
      q.limit(filters.$limit)
    }

    // Handle $skip
    if (filters.$skip) {
      q.offset(filters.$skip)
    }

    const executeQuery = total => {
      return q.then(data => {
        return {
          total,
          limit: filters.$limit,
          skip: filters.$skip || 0,
          data
        }
      })
    }

    if (count) {
      let countQuery = this.Model.query().count(`${this.id} as total`)

      this.objectify(countQuery, query)

      return countQuery.then(count => count[0].total).then(executeQuery)
    }

    return executeQuery()
  }

  /**
   * `find` service function for objection.
   * @param params
   */
  find (params) {
    const paginate = (params && typeof params.paginate !== 'undefined') ? params.paginate : this.paginate
    const result = this._find(params, !!paginate.default,
      query => filter(query, paginate)
    )

    if (!paginate.default) {
      return result.then(page => page.data)
    }

    return result
  }

  _get (id, params) {
    params.query = params.query || {}
    params.query[this.id] = id

    return this._find(params)
    .then(page => {
      if (page.data.length !== 1) {
        throw new errors.NotFound(`No record found for id '${id}'`)
      }

      return page.data[0]
    }).catch(errorHandler)
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
    return this.Model.query().insertAndFetch(data)
      // .then(rows => this._get(rows[0], params))
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
      return Promise.reject('Not replacing multiple records. Did you mean `patch`?')
    }

    // NOTE (EK): First fetch the old record so
    // that we can fill any existing keys that the
    // client isn't updating with null;
    return this._get(id, params).then(oldData => {
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

      return this.Model.query().where(this.id, id).update(newObject).then(() => {
        // NOTE (EK): Restore the id field so we can return it to the client
        newObject[this.id] = id
        return newObject
      })
    }).catch(errorHandler)
  }

  /**
   * `patch` service function for objection.
   * @param id
   * @param data
   * @param params
   */
  patch (id, raw, params) {
    const query = Object.assign({}, params.query)
    const data = Object.assign({}, raw)
    const patchQuery = {}

    if (id !== null) {
      query[this.id] = id
    }

    // Account for potentially modified data
    Object.keys(query).forEach(key => {
      if (query[key] !== undefined && data[key] !== undefined && typeof data[key] !== 'object') {
        patchQuery[key] = data[key]
      } else {
        patchQuery[key] = query[key]
      }
    })

    let q = this.Model.query()
    this.objectify(q, query)

    delete data[this.id]

    return q.patch(data).then(() => {
      return this._find({ query: patchQuery }).then(page => {
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
    }).catch(error => {
      errorHandler(error)
    })
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

    return this._find(params).then(page => {
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
    }).catch(errorHandler)
  }
}

export default function init (options) {
  return new Service(options)
}

init.Service = Service
