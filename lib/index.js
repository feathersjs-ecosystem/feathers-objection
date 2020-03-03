"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = init;

var _adapterCommons = require("@feathersjs/adapter-commons");

var _errors = _interopRequireDefault(require("@feathersjs/errors"));

var _objection = require("objection");

var _utils = _interopRequireDefault(require("./utils"));

var _errorHandler = _interopRequireDefault(require("./error-handler"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

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
const DESERIALIZED_ARRAY_OPERATORS = ['between', 'not between', '?|', '?&'];
const NON_COMPARISON_OPERATORS = ['@>', '?', '<@', '?|', '?&'];
const CAST_TO_TEXT = [OPERATORS_MAP.$like, OPERATORS_MAP.$ilike, OPERATORS_MAP.$notlike, OPERATORS_MAP.$notILike, OPERATORS_MAP.$regexp, OPERATORS_MAP.$iRegexp, OPERATORS_MAP.$notIRegexp, OPERATORS_MAP.$notRegexp];

const NO_RELATIONS = _objection.RelationExpression.create('[]');
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


class Service extends _adapterCommons.AdapterService {
  constructor(options) {
    if (!options.model) {
      throw new _errors.default.GeneralError('You must provide an Objection Model');
    }

    const whitelist = Object.values(OPERATORS).concat(options.whitelist || []);
    super(_extends({
      id: options.model.idColumn || 'id',
      whitelist
    }, options));
    this.idSeparator = options.idSeparator || ',';
    this.jsonSchema = options.model.jsonSchema;
    this.allowedEager = options.allowedEager;
    this.eagerOptions = options.eagerOptions;
    this.eagerFilters = options.eagerFilters;
    this.allowedInsert = options.allowedInsert && _objection.RelationExpression.create(options.allowedInsert);
    this.insertGraphOptions = options.insertGraphOptions;
    this.createUseUpsertGraph = options.createUseUpsertGraph;
    this.allowedUpsert = options.allowedUpsert && _objection.RelationExpression.create(options.allowedUpsert);
    this.upsertGraphOptions = options.upsertGraphOptions;
  }

  get Model() {
    return this.options.model;
  }

  getModel(params) {
    return this.options.model;
  }
  /**
   * Create a new query that re-queries all ids that were originally changed
   * @param id
   * @param idList
   * @param addTableName
   */


  getIdsQuery(id, idList, addTableName = true) {
    const query = {};

    if (Array.isArray(this.id)) {
      let ids = id;

      if (id && !Array.isArray(id)) {
        ids = _utils.default.extractIds(id, this.id, this.idSeparator);
      }

      this.id.forEach((idKey, index) => {
        if (!ids) {
          if (idList) {
            if (idList[index]) {
              query[idKey] = idList[index].length === 1 ? idList[index] : {
                $in: idList[index]
              };
            }
          } else {
            query[idKey] = null;
          }
        } else if (ids[index]) {
          query[idKey] = ids[index];
        } else {
          throw new _errors.default.BadRequest('When using composite primary key, id must contain values for all primary keys');
        }
      });
    } else {
      query[addTableName ? `${this.Model.tableName}.${this.id}` : this.id] = idList ? idList.length === 1 ? idList[0] : {
        $in: idList
      } : id;
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


  objectify(query, params, parentKey, methodKey) {
    if (params.$eager) {
      delete params.$eager;
    }

    if (params.$joinEager) {
      delete params.$joinEager;
    }

    if (params.$joinRelation) {
      delete params.$joinRelation;
    }

    if (params.$modifyEager) {
      delete params.$modifyEager;
    }

    if (params.$mergeEager) {
      delete params.$mergeEager;
    }

    if (params.$noSelect) {
      delete params.$noSelect;
    }

    Object.keys(params || {}).forEach(key => {
      let value = params[key];

      if (_utils.default.isPlainObject(value)) {
        return this.objectify(query, value, key, parentKey);
      }

      const column = parentKey && parentKey[0] !== '$' ? parentKey : key;
      const method = METHODS[methodKey] || METHODS[parentKey] || METHODS[key];
      const operator = OPERATORS_MAP[key] || '=';

      if (method) {
        if (key === '$or') {
          const self = this;
          return query.where(function () {
            return value.forEach(condition => {
              this.orWhere(function () {
                self.objectify(this, condition);
              });
            });
          });
        }

        if (key === '$and') {
          const self = this;
          return query.where(function () {
            return value.forEach(condition => {
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

      const property = this.jsonSchema && (this.jsonSchema.properties[column] || methodKey && this.jsonSchema.properties[methodKey]);
      let columnType = property && property.type;

      if (columnType) {
        if (Array.isArray(columnType)) {
          columnType = columnType[0];
        }

        if (columnType === 'object' || columnType === 'array') {
          let refColumn = null;

          if (!methodKey && key[0] === '$') {
            refColumn = (0, _objection.ref)(`${this.Model.tableName}.${column}`);
          } else {
            const prop = (methodKey ? column : key).replace(/\(/g, '[').replace(/\)/g, ']');
            refColumn = (0, _objection.ref)(`${this.Model.tableName}.${methodKey || column}:${prop}`);
          }

          if (operator === '@>') {
            if (Array.isArray(value)) {
              value = JSON.stringify(value);
            }
          } else if (DESERIALIZED_ARRAY_OPERATORS.includes(operator)) {
            if (typeof value === 'string' && value[0] === '[' && value[value.length - 1] === ']') {
              value = JSON.parse(value);
            }
          }

          return query.where(NON_COMPARISON_OPERATORS.includes(operator) ? refColumn : refColumn.castText(), operator, value);
        }
      }

      if (DESERIALIZED_ARRAY_OPERATORS.includes(operator) && typeof value === 'string' && value[0] === '[' && value[value.length - 1] === ']') {
        value = JSON.parse(value);
      }

      return operator === '=' ? query.where(column, value) : query.where(CAST_TO_TEXT.includes(operator) ? this.Model.raw('??::text', [column]) : column, operator, value);
    });
  }

  mergeRelations(optionRelations, paramRelations) {
    if (!paramRelations) {
      return optionRelations;
    }

    if (!optionRelations) {
      return _objection.RelationExpression.create(paramRelations);
    }

    return optionRelations.merge(paramRelations);
  }

  _createQuery(params = {}) {
    const trx = params.transaction ? params.transaction.trx : null;
    const joinOnSameTable = params.query.$joinEager && params.query.$joinEager.split(",").some(field => field.includes(this.Model.tableName));
    const q = this.Model.query(trx);

    if (joinOnSameTable) {
      q.alias(`_${this.Model.tableName}`);
    }

    return q;
  }

  createQuery(params = {}) {
    const {
      filters,
      query
    } = this.filterQuery(params);

    const q = this._createQuery(params).skipUndefined();

    const eagerOptions = _objectSpread({}, this.eagerOptions, {}, params.eagerOptions);

    if (this.allowedEager) {
      q.allowGraph(this.allowedEager);
    }

    if (params.mergeAllowEager) {
      q.allowGraph(params.mergeAllowEager);
    } // $select uses a specific find syntax, so it has to come first.


    if (filters.$select) {
      q.select(...filters.$select.concat(`${this.Model.tableName}.${this.id}`));
    } // $eager for Objection eager queries


    if (query && query.$eager) {
      q.withGraphFetched(query.$eager, eagerOptions);
      delete query.$eager;
    }

    if (query && query.$joinEager) {
      q.withGraphJoined(query.$joinEager, eagerOptions);
      delete query.$joinEager;
    }

    if (query && query.$joinRelation) {
      q.distinct(`${this.Model.tableName}.*`).joinRelated(query.$joinRelation);
      delete query.$joinRelation;
    }

    if (query && query.$mergeEager) {
      q[query.$joinEager ? 'withGraphJoined' : 'withGraphFetched'](query.$mergeEager, eagerOptions);
      delete query.$mergeEager;
    } // apply eager filters if specified


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
    } // build up the knex query out of the query params


    this.objectify(q, query);

    if (filters.$sort) {
      Object.keys(filters.$sort).forEach(key => {
        q.orderBy(key, filters.$sort[key] === 1 ? 'asc' : 'desc');
      });
    }

    return q;
  }
  /**
   * `find` service function for Objection.
   * @param params
   */


  _find(params) {
    const find = (params, count, filters, query) => {
      const q = params.objection || this.createQuery(params); // Handle $limit

      if (filters.$limit) {
        q.limit(filters.$limit);
      } // Handle $skip


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
          countQuery.joinRelated(query.$joinRelation).countDistinct({
            total: idColumns
          });
        } else if (query.$joinEager) {
          countQuery.joinRelation(query.$joinEager).countDistinct({
            total: idColumns
          });
        } else if (idColumns.length > 1) {
          countQuery.countDistinct({
            total: idColumns
          });
        } else {
          countQuery.count({
            total: idColumns
          });
        }

        this.objectify(countQuery, query);
        return countQuery.then(count => parseInt(count[0].total, 10)).then(executeQuery).catch(_errorHandler.default);
      }

      return executeQuery().catch(_errorHandler.default);
    };

    const {
      filters,
      query,
      paginate
    } = this.filterQuery(params);
    const result = find(params, Boolean(paginate && paginate.default), filters, query);

    if (!paginate || !paginate.default) {
      return result.then(page => page.data || page);
    }

    return result;
  }

  _get(id, params) {
    const query = _extends({}, params.query, this.getIdsQuery(id));

    return this._find(_extends({}, params, {
      query
    })).then(page => {
      const data = page.data || page;

      if (data.length !== 1) {
        throw new _errors.default.NotFound(`No record found for id '${id}'`);
      }

      return data[0];
    });
  }
  /**
   * `create` service function for Objection.
   * @param {object} data
   * @param {object} params
   */


  _create(data, params) {
    const create = (data, params) => {
      const q = this.createQuery(params);
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

      return q.then(row => {
        if (params.query && params.query.$noSelect) {
          return data;
        }

        let id = null;

        if (Array.isArray(this.id)) {
          id = [];

          for (const idKey of this.id) {
            id.push(typeof data[idKey] !== 'undefined' ? data[idKey] : row[idKey]);
          }
        } else {
          id = typeof data[this.id] !== 'undefined' ? data[this.id] : row[this.id];
        }

        return this._get(id, params);
      }).catch(_errorHandler.default);
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


  _update(id, data, params) {
    // NOTE (EK): First fetch the old record so
    // that we can fill any existing keys that the
    // client isn't updating with null;
    return this._get(id, params).then(oldData => {
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
        return this.createQuery(params).allowGraph(allowedUpsert).upsertGraphAndFetch(newObject, this.upsertGraphOptions);
      } // NOTE (EK): Delete id field so we don't update it


      if (Array.isArray(this.id)) {
        for (const idKey of this.id) {
          delete newObject[idKey];
        }
      } else {
        delete newObject[this.id];
      }

      return this.createQuery(params).where(this.getIdsQuery(id)).update(newObject).then(() => {
        // NOTE (EK): Restore the id field so we can return it to the client
        if (Array.isArray(this.id)) {
          newObject = _extends({}, newObject, this.getIdsQuery(id));
        } else {
          newObject[this.id] = id;
        }

        return newObject;
      });
    }).catch(_errorHandler.default);
  }
  /**
   * `patch` service function for Objection.
   * @param id
   * @param data
   * @param params
   */


  _patch(id, data, params) {
    let {
      filters,
      query
    } = this.filterQuery(params);
    const allowedUpsert = this.mergeRelations(this.allowedUpsert, params.mergeAllowUpsert);

    if (allowedUpsert && id !== null) {
      const dataCopy = _extends({}, data, this.getIdsQuery(id, null, false));

      return this.createQuery(params).allowGraph(allowedUpsert).upsertGraphAndFetch(dataCopy, this.upsertGraphOptions);
    }

    const dataCopy = _extends({}, data);

    const mapIds = page => Array.isArray(this.id) ? this.id.map(idKey => [...new Set((page.data || page).map(current => current[idKey]))]) : (page.data || page).map(current => current[this.id]); // By default we will just query for the one id. For multi patch
    // we create a list of the ids of all items that will be changed
    // to re-query them after the update


    const ids = id === null ? this._find(params).then(mapIds) : Promise.resolve([id]);

    if (id !== null) {
      if (Array.isArray(this.id)) {
        query = _extends({}, query, this.getIdsQuery(id));
      } else {
        query[this.id] = id;
      }
    }

    const q = this.createQuery(params);
    this.objectify(q, query);

    if (Array.isArray(this.id)) {
      for (const idKey of this.id) {
        delete dataCopy[idKey];
      }
    } else {
      delete dataCopy[this.id];
    }

    return ids.then(idList => {
      // Create a new query that re-queries all ids that
      // were originally changed
      const selectParam = filters.$select ? {
        $select: filters.$select
      } : undefined;

      const findParams = _extends({}, params, {
        query: _extends({}, params.query, this.getIdsQuery(id, idList), selectParam)
      });

      return q.patch(dataCopy).then(() => {
        return params.query && params.query.$noSelect ? {} : this._find(findParams).then(page => {
          const items = page.data || page;

          if (id !== null) {
            if (items.length === 1) {
              return items[0];
            } else {
              throw new _errors.default.NotFound(`No record found for id '${id}'`);
            }
          } else if (!items.length) {
            throw new _errors.default.NotFound(`No record found for id '${id}'`);
          }

          return items;
        });
      });
    }).catch(_errorHandler.default);
  }
  /**
   * `remove` service function for Objection.
   * @param id
   * @param params
   */


  _remove(id, params) {
    params.query = _extends({}, params.query); // NOTE (EK): First fetch the record so that we can return
    // it when we delete it.

    if (id !== null) {
      if (Array.isArray(this.id)) {
        params.query = _extends({}, params.query, this.getIdsQuery(id));
      } else {
        params.query[this.id] = id;
      }
    }

    const {
      query: queryParams
    } = this.filterQuery(params);
    const query = this.createQuery(params);
    this.objectify(query, queryParams);

    if (params.query && params.query.$noSelect) {
      return query.delete().then(() => {
        return {};
      }).catch(_errorHandler.default);
    } else {
      return this._find(params).then(page => {
        const items = page.data || page;
        return query.delete().then(() => {
          if (id !== null) {
            if (items.length === 1) {
              return items[0];
            } else {
              throw new _errors.default.NotFound(`No record found for id '${id}'`);
            }
          } else if (!items.length) {
            throw new _errors.default.NotFound(`No record found for id '${id}'`);
          }

          return items;
        });
      }).catch(_errorHandler.default);
    }
  }

}

function init(options) {
  return new Service(options);
}

init.Service = Service;
init.ERROR = _errorHandler.default.ERROR;
module.exports = exports.default;