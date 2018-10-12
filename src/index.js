import Proto from 'uberproto'
import { filterQuery } from '@feathersjs/commons'
import isPlainObject from 'is-plain-object'
import errorHandler from './error-handler'
import errors from '@feathersjs/errors'

const METHODS = {
  $or: 'orWhere',
  $and: 'andWhere',
  $ne: 'whereNot',
  $in: 'whereIn',
  $nin: 'whereNotIn'
}

const OPERATORS = [
  '$or',
  '$and',
  '$lt',
  '$lte',
  '$gt',
  '$gte',
  '$like',
  '$ilike',
  '$eager',
  '$joinEager',
  '$joinRelation',
  '$pick'
]

const OPERATORS_MAP = {
  $lt: '<',
  $lte: '<=',
  $gt: '>',
  $gte: '>=',
  $like: 'like',
  $ilike: 'ilike'
}

/**
 * Class representing an feathers adapter for Objection.js ORM.
 * @param {object} options
 * @param {string} [options.id='id'] - database id field
 * @param {string} [options.idSeparator=','] - id field primary keys separator char
 * @param {object} options.model - an Objection model
 * @param {object} options.paginate
 * @param {object} options.events
 * @param {string} options.allowedEager - Objection eager loading string.
 */
class Service {
  constructor (options) {
    if (!options) {
      throw new errors.GeneralError('Objection options have to be provided')
    }

    if (!options.model) {
      throw new errors.GeneralError('You must provide an Objection Model')
    }

    this.options = options || {}
    this.id = options.id || 'id'
    this.idSeparator = options.idSeparator || ','
    this.paginate = options.paginate || {}
    this.events = options.events || []
    this.Model = options.model
    this.allowedEager = options.allowedEager || '[]'
    this.namedEagerFilters = options.namedEagerFilters
    this.eagerFilters = options.eagerFilters
    this.allowedInsert = options.allowedInsert
    this.insertGraphOptions = options.insertGraphOptions
    this.createUseUpsertGraph = options.createUseUpsertGraph || false
    this.allowedUpsert = options.allowedUpsert
    this.upsertGraphOptions = options.upsertGraphOptions
  }

  extend (obj) {
    return Proto.extend(obj, this)
  }

  extractIds (id) {
    if (typeof id === 'object') { return this.id.map(idKey => id[idKey]) }
    if (id[0] === '[' && id[id.length - 1] === ']') { return JSON.parse(id) }
    if (id[0] === '{' && id[id.length - 1] === '}') {
      const obj = JSON.parse(id)
      return Object.keys(obj).map(key => obj[key])
    }

    if (typeof id !== 'string' || !id.includes(this.idSeparator)) { throw new errors.BadRequest('When using composite primary key, id must contain values for all primary keys') }

    return id.split(this.idSeparator)
  }

  // Create a new query that re-queries all ids that were originally changed
  getIdsQuery (id, idList) {
    const query = {}

    if (Array.isArray(this.id)) {
      let ids = id

      if (id && !Array.isArray(id)) {
        ids = this.extractIds(id)
      }

      this.id.forEach((idKey, index) => {
        if (!ids) {
          if (idList) {
            if (idList[index]) {
              query[idKey] = idList[index].length === 1 ? idList[index] : { $in: idList[index] }
            }
          } else {
            query[idKey] = null
          }
        } else if (ids[index]) {
          query[idKey] = ids[index]
        } else {
          throw new errors.BadRequest('When using composite primary key, id must contain values for all primary keys')
        }
      })
    } else {
      query[`${this.Model.tableName}.${this.id}`] = idList ? (idList.length === 1 ? idList[0] : { $in: idList }) : id
    }

    return query
  }

  /**
   * Maps a feathers query to the Objection/Knex schema builder functions.
   * @param query - a query object. i.e. { type: 'fish', age: { $lte: 5 }
   * @param params
   * @param parentKey
   */
  objectify (query, params, parentKey) {
    if (params.$eager) { delete params.$eager }
    if (params.$joinEager) { delete params.$joinEager }
    if (params.$joinRelation) { delete params.$joinRelation }
    if (params.$pick) { delete params.$pick }

    Object.keys(params || {}).forEach(key => {
      const value = params[key]

      if (isPlainObject(value)) {
        return this.objectify(query, value, key)
      }

      const column = parentKey || key
      const method = METHODS[key]
      const operator = OPERATORS_MAP[key] || '='

      if (method) {
        if (key === '$or') {
          const self = this

          return query.where(function () {
            return value.forEach((condition) => {
              this.orWhere(function () {
                self.objectify(this, condition)
              })
            })
          })
        }

        if (key === '$and') {
          const self = this

          return query.where(function () {
            return value.forEach((condition) => {
              this.andWhere(function () {
                self.objectify(this, condition)
              })
            })
          })
        }

        return query[method].call(query, column, value) // eslint-disable-line no-useless-call
      }

      return operator === '=' ? query.where(column, value) : query.where(column, operator, value)
    })
  }

  _createQuery (params = {}) {
    let trx = params.transaction ? params.transaction.trx : null
    let q = this.Model.query(trx)
    return q
  }

  createQuery (params = {}) {
    const { filters, query } = filterQuery(params.query || {}, { operators: OPERATORS })
    let q = this._createQuery(params)
      .skipUndefined()
      .allowEager(this.allowedEager)

    if (params.mergeAllowEager) {
      q.mergeAllowEager(params.mergeAllowEager)
    }

    // $select uses a specific find syntax, so it has to come first.
    if (filters.$select) {
      q = q.select(...filters.$select.concat(this.id))
    }

    // $eager for Objection eager queries

    if (query && query.$eager) {
      q.eager(query.$eager, this.namedEagerFilters)
      delete query.$eager
    }

    if (query && query.$joinEager) {
      q
        .eagerAlgorithm(this.Model.JoinEagerAlgorithm)
        .eager(query.$joinEager, this.namedEagerFilters)
      delete query.$joinEager
    }

    if (query && query.$joinRelation) {
      q
        .distinct(`${this.Model.tableName}.*`)
        .joinRelation(query.$joinRelation)

      delete query.$joinRelation
    }

    // apply eager filters if specified
    if (this.eagerFilters) {
      const eagerFilters = this.eagerFilters
      if (Array.isArray(eagerFilters)) {
        for (const eagerFilter of eagerFilters) {
          q.filterEager(eagerFilter.expression, eagerFilter.filter)
        }
      } else {
        q.filterEager(eagerFilters.expression, eagerFilters.filter)
      }
    }

    if (query && query.$pick) {
      q = q.pick(query.$pick)
      delete query.$pick
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

  _find (params, count, getFilter = filterQuery) {
    const { filters, query } = getFilter(params.query || {}, { operators: OPERATORS })
    const q = params.objection || this.createQuery(params)

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
      const idColumns = Array.isArray(this.id) ? this.id.map(idKey => `${this.Model.tableName}.${idKey}`) : [`${this.Model.tableName}.${this.id}`]

      let countQuery = this._createQuery(params)
        .skipUndefined()
        .joinRelation(query.$joinRelation)
        .countDistinct({ total: idColumns })

      this.objectify(countQuery, query)

      return countQuery
        .then(count => parseInt(count[0].total, 10))
        .then(executeQuery)
        .catch(errorHandler)
    }

    return executeQuery().catch(errorHandler)
  }

  /**
   * `find` service function for Objection.
   * @param params
   */
  find (params) {
    const paginate =
      params && typeof params.paginate !== 'undefined'
        ? params.paginate
        : this.paginate
    const result = this._find(params, !!paginate.default, query =>
      filterQuery(query, { paginate, operators: OPERATORS })
    )

    if (!paginate.default) {
      return result.then(page => page.data)
    }

    return result
  }

  _get (id, params) {
    const query = Object.assign({}, params.query, this.getIdsQuery(id))

    return this._find(Object.assign({}, params, { query }))
      .then(page => {
        if (page.data.length !== 1) {
          throw new errors.NotFound(`No record found for id '${id}'`)
        }

        return page.data[0]
      })
  }

  /**
   * `get` service function for Objection.
   * @param {...object} args
   * @return {Promise} - promise containing the data being retrieved
   */
  get (...args) {
    return this._get(...args)
  }

  _create (data, params) {
    let q = this._createQuery(params)

    if (this.createUseUpsertGraph) {
      if (this.allowedUpsert) {
        q.allowUpsert(this.allowedUpsert)
      }
      q.upsertGraphAndFetch(data, this.upsertGraphOptions)
    } else if (this.allowedInsert) {
      q.allowInsert(this.allowedInsert)
      q.insertGraph(data, this.insertGraphOptions)
    } else {
      q.insert(data, this.id)
    }
    return q
      .then(row => {
        let id = null

        if (Array.isArray(this.id)) {
          id = []

          for (const idKey of this.id) {
            id.push(typeof data[idKey] !== 'undefined' ? data[idKey] : row[idKey])
          }
        } else {
          id = typeof data[this.id] !== 'undefined' ? data[this.id] : row[this.id]
        }

        return this._get(id, params)
      })
      .catch(errorHandler)
  }

  /**
   * `create` service function for Objection.
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
   * `update` service function for Objection.
   * @param id
   * @param data
   * @param params
   */
  update (id, data, params) {
    if (Array.isArray(data)) {
      return Promise.reject(
        new errors.BadRequest('Not replacing multiple records. Did you mean `patch`?')
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

        if (this.allowedUpsert) {
          return this._createQuery(params)
            .allowUpsert(this.allowedUpsert)
            .upsertGraphAndFetch(newObject, this.upsertGraphOptions)
        }

        // NOTE (EK): Delete id field so we don't update it
        if (Array.isArray(this.id)) {
          for (const idKey of this.id) {
            delete newObject[idKey]
          }
        } else {
          delete newObject[this.id]
        }
        return this._createQuery(params)
          .where(this.getIdsQuery(id))
          .update(newObject)
          .then(() => {
            // NOTE (EK): Restore the id field so we can return it to the client
            if (Array.isArray(this.id)) {
              newObject = Object.assign({}, newObject, this.getIdsQuery(id))
            } else {
              newObject[this.id] = id
            }

            return newObject
          })
      })
      .catch(errorHandler)
  }

  /**
   * `patch` service function for Objection.
   * @param id
   * @param data
   * @param params
   */
  patch (id, data, params) {
    let query = filterQuery(params.query || {}, { operators: OPERATORS }).query
    const dataCopy = Object.assign({}, data)

    const mapIds = page => Array.isArray(this.id)
      ? this.id.map(idKey => [...new Set(page.data.map(current => current[idKey]))])
      : page.data.map(current => current[this.id])

    // By default we will just query for the one id. For multi patch
    // we create a list of the ids of all items that will be changed
    // to re-query them after the update
    const ids =
      id === null ? this._find(params).then(mapIds) : Promise.resolve([id])

    if (id !== null) {
      if (Array.isArray(this.id)) {
        query = Object.assign({}, query, this.getIdsQuery(id))
      } else {
        query[this.id] = id
      }
    }

    let q = this._createQuery(params)

    this.objectify(q, query)

    if (Array.isArray(this.id)) {
      for (const idKey of this.id) {
        delete dataCopy[idKey]
      }
    } else {
      delete dataCopy[this.id]
    }

    return ids
      .then(idList => {
        // Create a new query that re-queries all ids that
        // were originally changed
        const findParams = Object.assign({}, params, { query: Object.assign({}, this.getIdsQuery(id, idList), { $select: params.query && params.query.$select }) })

        return q.patch(dataCopy).then(() => {
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
   * `remove` service function for Objection.
   * @param id
   * @param params
   */
  remove (id, params) {
    params.query = Object.assign({}, params.query)

    // NOTE (EK): First fetch the record so that we can return
    // it when we delete it.
    if (id !== null) {
      if (Array.isArray(this.id)) {
        params.query = Object.assign({}, params.query, this.getIdsQuery(id))
      } else {
        params.query[this.id] = id
      }
    }

    return this._find(params)
      .then(page => {
        const items = page.data
        const { query: queryParams } = filterQuery(params.query || {}, { operators: OPERATORS })
        const query = this._createQuery(params)

        this.objectify(query, queryParams)

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
