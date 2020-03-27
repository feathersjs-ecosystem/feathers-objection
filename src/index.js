import { AdapterService } from '@feathersjs/adapter-commons';
import errors from '@feathersjs/errors';
import { ref, RelationExpression } from 'objection';
import utils from './utils';
import errorHandler from './error-handler';

const METHODS = {
  $or: 'orWhere',
  $and: 'andWhere',
  $ne: 'whereNot',
  $in: 'whereIn',
  $nin: 'whereNotIn',
  $null: 'whereNull'
};

const OPERATORS = {
  eq: '$eq',
  ne: '$ne',
  gte: '$gte',
  gt: '$gt',
  lte: '$lte',
  lt: '$lt',
  in: '$in',
  notIn: '$nin',
  like: '$like',
  notLike: '$notLike',
  ilike: '$ilike',
  notILike: '$notILike',
  or: '$or',
  and: '$and'
};

const OPERATORS_MAP = {
  $lt: '<',
  $lte: '<=',
  $gt: '>',
  $gte: '>=',
  $like: 'like',
  $notLike: 'not like',
  $ilike: 'ilike',
  $notILike: 'not ilike',
  $regexp: '~',
  $notRegexp: '!~',
  $iRegexp: '~*',
  $notIRegexp: '!~*',
  $between: 'between',
  $notBetween: 'not between',
  $contains: '@>',
  $containsKey: '?',
  $contained: '<@',
  $any: '?|',
  $all: '?&'
};

const DESERIALIZED_ARRAY_OPERATORS = [
  'between',
  'not between',
  '?|',
  '?&'
];

const NON_COMPARISON_OPERATORS = [
  '@>',
  '?',
  '<@',
  '?|',
  '?&'
];

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
class Service extends AdapterService {
  constructor (options) {
    if (!options.model) {
      throw new errors.GeneralError('You must provide an Objection Model');
    }

    const whitelist = Object.values(OPERATORS).concat(options.whitelist || []);

    super(Object.assign({
      id: options.model.idColumn || 'id',
      whitelist
    }, options));

    this.idSeparator = options.idSeparator || ',';
    this.jsonSchema = options.model.jsonSchema;
    this.allowedEager = options.allowedEager;
    this.eagerOptions = options.eagerOptions;
    this.eagerFilters = options.eagerFilters;
    this.allowedInsert = options.allowedInsert && RelationExpression.create(options.allowedInsert);
    this.insertGraphOptions = options.insertGraphOptions;
    this.createUseUpsertGraph = options.createUseUpsertGraph;
    this.allowedUpsert = options.allowedUpsert && RelationExpression.create(options.allowedUpsert);
    this.upsertGraphOptions = options.upsertGraphOptions;
  }

  get Model () {
    return this.options.model;
  }

  getModel (params) {
    return this.options.model;
  }

  /**
   * Create a new query that re-queries all ids that were originally changed
   * @param id
   * @param idList
   * @param addTableName
   */
  getIdsQuery (id, idList, addTableName = true) {
    const query = {};

    if (Array.isArray(this.id)) {
      let ids = id;

      if (id && !Array.isArray(id)) {
        ids = utils.extractIds(id, this.id, this.idSeparator);
      }

      this.id.forEach((idKey, index) => {
        if (!ids) {
          if (idList) {
            if (idList[index]) {
              query[idKey] = idList[index].length === 1 ? idList[index] : { $in: idList[index] };
            }
          } else {
            query[idKey] = null;
          }
        } else if (ids[index]) {
          query[idKey] = ids[index];
        } else {
          throw new errors.BadRequest('When using composite primary key, id must contain values for all primary keys');
        }
      });
    } else {
      query[addTableName ? `${this.Model.tableName}.${this.id}` : this.id] = idList ? (idList.length === 1 ? idList[0] : { $in: idList }) : id;
    }

    return query;
  }

  /**
   * Maps a feathers query to the Objection/Knex schema builder functions.
   * @param query - a query object. i.e. { type: 'fish', age: { $lte: 5 }
   * @param params
   * @param parentKey
   * @param methodKey
   */
  objectify (query, params, parentKey, methodKey) {
    if (params.$eager) { delete params.$eager; }
    if (params.$joinEager) { delete params.$joinEager; }
    if (params.$joinRelation) { delete params.$joinRelation; }
    if (params.$modifyEager) { delete params.$modifyEager; }
    if (params.$mergeEager) { delete params.$mergeEager; }
    if (params.$noSelect) { delete params.$noSelect; }
    if (params.$modify) { delete params.$modify; }

    Object.keys(params || {}).forEach(key => {
      let value = params[key];

      if (utils.isPlainObject(value)) {
        return this.objectify(query, value, key, parentKey);
      }

      const column = parentKey && parentKey[0] !== '$' ? parentKey : key;
      const method = METHODS[methodKey] || METHODS[parentKey] || METHODS[key];
      const operator = OPERATORS_MAP[key] || '=';

      if (method) {
        if (key === '$or') {
          const self = this;

          return query.where(function () {
            return value.forEach((condition) => {
              this.orWhere(function () {
                self.objectify(this, condition);
              });
            });
          });
        }

        if (key === '$and') {
          const self = this;

          return query.where(function () {
            return value.forEach((condition) => {
              this.andWhere(function () {
                self.objectify(this, condition);
              });
            });
          });
        }

        if (key === '$null') {
          return query[value.toString() === 'true' ? method : 'whereNotNull'](column);
        }

        return query[method].call(query, column, value); // eslint-disable-line no-useless-call
      }

      const property = this.jsonSchema && (this.jsonSchema.properties[column] || (methodKey && this.jsonSchema.properties[methodKey]));
      let columnType = property && property.type;
      if (columnType) {
        if (Array.isArray(columnType)) { columnType = columnType[0]; }
        if (columnType === 'object' || columnType === 'array') {
          let refColumn = null;

          if (!methodKey && key[0] === '$') {
            refColumn = ref(`${this.Model.tableName}.${column}`);
          } else {
            const prop = (methodKey ? column : key)
              .replace(/\(/g, '[')
              .replace(/\)/g, ']');

            refColumn = ref(`${this.Model.tableName}.${methodKey || column}:${prop}`);
          }

          if (operator === '@>') {
            if (Array.isArray(value)) { value = JSON.stringify(value); }
          } else if (DESERIALIZED_ARRAY_OPERATORS.includes(operator)) {
            if (typeof value === 'string' && value[0] === '[' && value[value.length - 1] === ']') { value = JSON.parse(value); }
          }

          return query.where(
            NON_COMPARISON_OPERATORS.includes(operator) ? refColumn : refColumn.castText(),
            operator,
            value
          );
        }
      }

      if (DESERIALIZED_ARRAY_OPERATORS.includes(operator) && typeof value === 'string' && value[0] === '[' && value[value.length - 1] === ']') {
        value = JSON.parse(value);
      }

      return operator === '=' ? query.where(column, value) : query.where(column, operator, value);
    });
  }

  mergeRelations (optionRelations, paramRelations) {
    if (!paramRelations) {
      return optionRelations;
    }

    if (!optionRelations) {
      return RelationExpression.create(paramRelations);
    }

    return optionRelations.merge(paramRelations);
  }

  _createQuery (params = {}) {
    const trx = params.transaction ? params.transaction.trx : null;
    return this.Model.query(trx);
  }

  createQuery (params = {}) {
    const { filters, query } = this.filterQuery(params);
    const q = this._createQuery(params).skipUndefined();
    const eagerOptions = { ...this.eagerOptions, ...params.eagerOptions };

    if (this.allowedEager) { q.allowGraph(this.allowedEager); }

    if (params.mergeAllowEager) { q.allowGraph(params.mergeAllowEager); }

    // $select uses a specific find syntax, so it has to come first.
    if (filters.$select) {
      const items = filters.$select.concat(`${this.Model.tableName}.${this.id}`);

      for (const [key, item] of Object.entries(items)) {
        const matches = item.match(/^ref\((.+)\)( as (.+))?$/);
        if (matches) {
          items[key] = ref(matches[1]).as(matches[3] || matches[1]);
        }
      }

      q.select(...items);
    }

    // $eager for Objection eager queries
    if (query && query.$eager) {
      q.withGraphFetched(query.$eager, eagerOptions);

      delete query.$eager;
    }

    if (query && query.$joinEager) {
      q.withGraphJoined(query.$joinEager, eagerOptions);

      delete query.$joinEager;
    }

    if (query && query.$joinRelation) {
      q
        .distinct(`${this.Model.tableName}.*`)
        .joinRelated(query.$joinRelation);

      delete query.$joinRelation;
    }

    if (query && query.$mergeEager) {
      q[query.$joinEager ? 'withGraphJoined' : 'withGraphFetched'](query.$mergeEager, eagerOptions);

      delete query.$mergeEager;
    }

    if (query && query.$modify) {
      if (typeof query.$modify === 'string') {
        if (query.$modify[0] === '[' && query.$modify[query.$modify.length - 1] === ']') { q.modify(...JSON.parse(query.$modify)); } else { q.modify(query.$modify.split(',')); }
      } else {
        q.modify(...query.$modify);
      }

      delete query.$modify;
    }

    // apply eager filters if specified
    if (this.eagerFilters) {
      const eagerFilters = Array.isArray(this.eagerFilters) ? this.eagerFilters : [this.eagerFilters];

      for (const eagerFilter of eagerFilters) {
        q.modifyGraph(eagerFilter.expression, eagerFilter.filter);
      }
    }

    if (query && query.$modifyEager) {
      for (const eagerFilterExpression of Object.keys(query.$modifyEager)) {
        const eagerFilterQuery = query.$modifyEager[eagerFilterExpression];

        q.modifyGraph(eagerFilterExpression, builder => {
          this.objectify(builder, eagerFilterQuery);
        });
      }

      delete query.$modifyEager;
    }

    // build up the knex query out of the query params
    this.objectify(q, query);

    if (filters.$sort) {
      Object.keys(filters.$sort).forEach(item => {
        const matches = item.match(/^ref\((.+)\)$/);
        const key = matches ? ref(matches[1]) : item;

        q.orderBy(key, filters.$sort[item] === 1 ? 'asc' : 'desc');
      });
    }

    return q;
  }

  /**
   * `find` service function for Objection.
   * @param params
   */
  _find (params) {
    const find = (params, count, filters, query) => {
      const q = params.objection || this.createQuery(params);

      // Handle $limit
      if (filters.$limit) {
        q.limit(filters.$limit);
      }

      // Handle $skip
      if (filters.$skip) {
        q.offset(filters.$skip);
      }

      let executeQuery = total => {
        return q.then(data => {
          return {
            total,
            limit: filters.$limit,
            skip: filters.$skip || 0,
            data
          };
        });
      };

      if (filters.$limit === 0) {
        executeQuery = total => {
          return Promise.resolve({
            total,
            limit: filters.$limit,
            skip: filters.$skip || 0,
            data: []
          });
        };
      }

      if (count) {
        const idColumns = Array.isArray(this.id) ? this.id.map(idKey => `${this.Model.tableName}.${idKey}`) : [`${this.Model.tableName}.${this.id}`];

        const countQuery = this._createQuery(params);

        if (query.$joinRelation) {
          countQuery
            .joinRelated(query.$joinRelation)
            .countDistinct({ total: idColumns });
        } else if (idColumns.length > 1) {
          countQuery.countDistinct({ total: idColumns });
        } else {
          countQuery.count({ total: idColumns });
        }

        this.objectify(countQuery, query);

        return countQuery
          .then(count => parseInt(count[0].total, 10))
          .then(executeQuery)
          .catch(errorHandler);
      }

      return executeQuery().catch(errorHandler);
    };

    const { filters, query, paginate } = this.filterQuery(params);
    const result = find(params, Boolean(paginate && paginate.default), filters, query);

    if (!paginate || !paginate.default) {
      return result.then(page => page.data || page);
    }

    return result;
  }

  _get (id, params) {
    const query = Object.assign({}, params.query, this.getIdsQuery(id));

    return this._find(Object.assign({}, params, { query }))
      .then(page => {
        const data = page.data || page;

        if (data.length !== 1) {
          throw new errors.NotFound(`No record found for id '${id}'`);
        }

        return data[0];
      });
  }

  /**
   * `create` service function for Objection.
   * @param {object} data
   * @param {object} params
   */
  _create (data, params) {
    const create = (data, params) => {
      const q = this._createQuery(params);
      const allowedUpsert = this.mergeRelations(this.allowedUpsert, params.mergeAllowUpsert);
      const allowedInsert = this.mergeRelations(this.allowedInsert, params.mergeAllowInsert);

      if (this.createUseUpsertGraph) {
        if (allowedUpsert) {
          q.allowGraph(allowedUpsert);
        }
        q.upsertGraphAndFetch(data, this.upsertGraphOptions);
      } else if (allowedInsert) {
        q.allowGraph(allowedInsert);
        q.insertGraph(data, this.insertGraphOptions);
      } else {
        q.insert(data, this.id);
      }
      return q
        .then(row => {
          if (params.query && params.query.$noSelect) { return data; }

          let id = null;

          if (Array.isArray(this.id)) {
            id = [];

            for (const idKey of this.id) {
              id.push(row[idKey]);
            }
          } else {
            id = row[this.id];
          }

          return this._get(id, params);
        })
        .catch(errorHandler);
    };

    if (Array.isArray(data)) {
      return Promise.all(data.map(current => create(current, params)));
    }

    return create(data, params);
  }

  /**
   * `update` service function for Objection.
   * @param id
   * @param data
   * @param params
   */
  _update (id, data, params) {
    // NOTE (EK): First fetch the old record so
    // that we can fill any existing keys that the
    // client isn't updating with null;
    return this._get(id, params)
      .then(oldData => {
        let newObject = {};

        for (const key of Object.keys(oldData)) {
          if (data[key] === undefined) {
            newObject[key] = null;
          } else {
            newObject[key] = data[key];
          }
        }

        const allowedUpsert = this.mergeRelations(this.allowedUpsert, params.mergeAllowUpsert);
        if (allowedUpsert) {
          return this._createQuery(params)
            .allowGraph(allowedUpsert)
            .upsertGraphAndFetch(newObject, this.upsertGraphOptions);
        }

        // NOTE (EK): Delete id field so we don't update it
        if (Array.isArray(this.id)) {
          for (const idKey of this.id) {
            delete newObject[idKey];
          }
        } else {
          delete newObject[this.id];
        }
        return this._createQuery(params)
          .where(this.getIdsQuery(id))
          .update(newObject)
          .then(() => {
            // NOTE (EK): Restore the id field so we can return it to the client
            if (Array.isArray(this.id)) {
              newObject = Object.assign({}, newObject, this.getIdsQuery(id));
            } else {
              newObject[this.id] = id;
            }

            return newObject;
          });
      })
      .catch(errorHandler);
  }

  /**
   * `patch` service function for Objection.
   * @param id
   * @param data
   * @param params
   */
  _patch (id, data, params) {
    let { filters, query } = this.filterQuery(params);

    const allowedUpsert = this.mergeRelations(this.allowedUpsert, params.mergeAllowUpsert);
    if (allowedUpsert && id !== null) {
      const dataCopy = Object.assign({}, data, this.getIdsQuery(id, null, false));

      return this._createQuery(params)
        .allowGraph(allowedUpsert)
        .upsertGraphAndFetch(dataCopy, this.upsertGraphOptions);
    }

    const dataCopy = Object.assign({}, data);

    const mapIds = page => Array.isArray(this.id)
      ? this.id.map(idKey => [...new Set((page.data || page).map(current => current[idKey]))])
      : (page.data || page).map(current => current[this.id]);

    // By default we will just query for the one id. For multi patch
    // we create a list of the ids of all items that will be changed
    // to re-query them after the update
    const ids =
      id === null ? this._find(params).then(mapIds) : Promise.resolve([id]);

    if (id !== null) {
      if (Array.isArray(this.id)) {
        query = Object.assign({}, query, this.getIdsQuery(id));
      } else {
        query[this.id] = id;
      }
    }

    const q = this._createQuery(params);

    this.objectify(q, query);

    if (Array.isArray(this.id)) {
      for (const idKey of this.id) {
        delete dataCopy[idKey];
      }
    } else {
      delete dataCopy[this.id];
    }

    return ids
      .then(idList => {
        // Create a new query that re-queries all ids that
        // were originally changed
        const selectParam = filters.$select ? { $select: filters.$select } : undefined;
        const findParams = Object.assign({}, params, { query: Object.assign({}, params.query, this.getIdsQuery(id, idList), selectParam) });

        return q.patch(dataCopy).then(() => {
          return params.query && params.query.$noSelect ? {} : this._find(findParams).then(page => {
            const items = page.data || page;

            if (id !== null) {
              if (items.length === 1) {
                return items[0];
              } else {
                throw new errors.NotFound(`No record found for id '${id}'`);
              }
            } else if (!items.length) {
              throw new errors.NotFound(`No record found for id '${id}'`);
            }

            return items;
          });
        });
      })
      .catch(errorHandler);
  }

  /**
   * `remove` service function for Objection.
   * @param id
   * @param params
   */
  _remove (id, params) {
    params.query = Object.assign({}, params.query);

    // NOTE (EK): First fetch the record so that we can return
    // it when we delete it.
    if (id !== null) {
      if (Array.isArray(this.id)) {
        params.query = Object.assign({}, params.query, this.getIdsQuery(id));
      } else {
        params.query[this.id] = id;
      }
    }

    const { query: queryParams } = this.filterQuery(params);
    const query = this._createQuery(params);

    this.objectify(query, queryParams);

    if (params.query && params.query.$noSelect) {
      return query.delete().then(() => {
        return {};
      })
        .catch(errorHandler);
    } else {
      return this._find(params)
        .then(page => {
          const items = page.data || page;

          return query.delete().then(() => {
            if (id !== null) {
              if (items.length === 1) {
                return items[0];
              } else {
                throw new errors.NotFound(`No record found for id '${id}'`);
              }
            } else if (!items.length) {
              throw new errors.NotFound(`No record found for id '${id}'`);
            }

            return items;
          });
        })
        .catch(errorHandler);
    }
  }
}

export default function init (options) {
  return new Service(options);
}

init.Service = Service;
init.ERROR = errorHandler.ERROR;
