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
  $null: 'whereNull',
  $not: 'whereNot'
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
  and: '$and',
  whereNot: '$not'
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
    const id = options.model.idColumn || 'id';

    super(Object.assign({ id }, options, { whitelist }));

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
    this.schema = options.schema;
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
   * @param allowRefs
   */
  objectify (query, params, parentKey, methodKey, allowRefs) {
    if (params.$eager) { delete params.$eager; }
    if (params.$joinEager) { delete params.$joinEager; }
    if (params.$joinRelation) { delete params.$joinRelation; }
    if (params.$leftJoinRelation) { delete params.$leftJoinRelation; }
    if (params.$modifyEager) { delete params.$modifyEager; }
    if (params.$mergeEager) { delete params.$mergeEager; }
    if (params.$noSelect) { delete params.$noSelect; }
    if (params.$modify) { delete params.$modify; }
    if (params.$allowRefs) { delete params.$allowRefs; }

    Object.keys(params || {}).forEach(key => {
      let value = params[key];

      if (key === '$not') {
        const self = this;
        if (Array.isArray(value)) { // Array = $and operator
          value = { $and: value };
        }
        return query.whereNot(function () {
          // continue with all queries inverted
          self.objectify(this, value, parentKey, methodKey, allowRefs);
        });
      }

      if (utils.isPlainObject(value)) {
        return this.objectify(query, value, key, parentKey, allowRefs);
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
                self.objectify(this, condition, null, null, allowRefs);
              });
            });
          });
        }

        if (key === '$and') {
          const self = this;

          return query.where(function () {
            return value.forEach((condition) => {
              this.andWhere(function () {
                self.objectify(this, condition, null, null, allowRefs);
              });
            });
          });
        }

        if (key === '$null') {
          return query[value.toString() === 'true' ? method : 'whereNotNull'](column);
        }

        return query[method].call(query, column, value); // eslint-disable-line no-useless-call
      }

      const property = this.jsonSchema && this.jsonSchema.properties && (this.jsonSchema.properties[column] || (methodKey && this.jsonSchema.properties[methodKey]));
      let columnType = property && property.type;
      if (columnType) {
        if (Array.isArray(columnType)) { columnType = columnType[0]; }
        if (columnType === 'object' || columnType === 'array') {
          let refColumn;

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

      if (allowRefs && typeof value === 'string') {
        const refMatches = value.match(/^ref\((.+)\)$/);

        if (refMatches) { value = ref(refMatches[1]); }
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

  modifyQuery (query, modify) {
    let modifiers = null;

    if (typeof modify === 'string') {
      if (modify[0] === '[' && modify[modify.length - 1] === ']') {
        query.modify(...JSON.parse(modify));
      } else if (modify[0] === '{' && modify[modify.length - 1] === '}') {
        modifiers = JSON.parse(modify);
      } else {
        query.modify(modify.split(','));
      }
    } else if (Array.isArray(modify)) {
      query.modify(...modify);
    } else {
      modifiers = modify;
    }

    if (modifiers) {
      for (const [modifier, args] of Object.entries(modifiers)) {
        if (args === true) { query.modify(modifier); } else { query.modify(modifier, ...args); }
      }
    }
  }

  getGroupByColumns (query) {
    for (const operation of query._operations) {
      if (operation.name === 'groupBy') {
        const args = operation.args;

        return Array.isArray(args[0]) ? args[0] : args;
      }
    }

    return null;
  }

  async _createTransaction (params) {
    if (!params.transaction && params.atomic) {
      delete params.atomic;
      params.transaction = params.transaction || {};
      params.transaction.trx = await this.Model.startTransaction();
      return params.transaction;
    }
    return null;
  }

  _commitTransaction (transaction) {
    return async (data) => {
      if (transaction) {
        await transaction.trx.commit();
      }
      return data;
    };
  }

  _rollbackTransaction (transaction) {
    return async (err) => {
      if (transaction) {
        await transaction.trx.rollback();
      }
      throw err;
    };
  }

  _createQuery (params = {}) {
    const trx = params.transaction ? params.transaction.trx : null;
    const schema = params.schema || this.schema;
    const query = this.Model.query(trx);
    if (schema) {
      query.context({
        onBuild (builder) {
          builder.withSchema(schema);
        }
      });
    }
    return query;
  }

  _selectQuery (q, $select) {
    if ($select && Array.isArray($select)) {
      const items = $select.concat(Array.isArray(this.id) ? this.id.map(el => { return `${this.Model.tableName}.${el}`; }) : `${this.Model.tableName}.${this.id}`);

      for (const [key, item] of Object.entries(items)) {
        const matches = item.match(/^ref\((.+)\)( as (.+))?$/);
        if (matches) {
          items[key] = ref(matches[1]).as(matches[3] || matches[1]);
        }
      }

      q.select(...items);
    }
    return q;
  }

  // Analyse $select and get an object map with fields -> alias
  _selectAliases ($select) {
    if (!Array.isArray($select)) {
      return {
      };
    }
    return $select.reduce((result, item) => {
      const matches = item.match(/^(?:ref\((\S+)\)|(\S+))(?: as (.+))?$/);
      if (matches) {
        const tableField = matches[1] || matches[2];
        const field = tableField.startsWith(`${this.Model.tableName}.`) ? tableField.substr(this.Model.tableName.length + 1) : tableField;
        const alias = matches[3] || field;
        result[field] = alias;
      } else {
        // Can't parse $select !
        throw new errors.BadRequest(`${item} is not a valid select statement`);
      }
      return result;
    }, {});
  }

  _selectFields (params, originalData = {}) {
    return newObject => {
      if (params.query && params.query.$noSelect) {
        return originalData;
      }
      // Remove not selected fields
      if (params.query && params.query.$select && !params.query.$select.find(field => field === '*' || field === `${this.Model.tableName}.*`)) {
        const $fieldsOrAliases = this._selectAliases(params.query.$select);
        for (const key of Object.keys(newObject)) {
          if (!$fieldsOrAliases[key]) {
            delete newObject[key];
          } else if ($fieldsOrAliases[key] !== key) {
            // Aliased field
            newObject[$fieldsOrAliases[key]] = newObject[key];
            delete newObject[key];
          }
        }
      }
      return newObject;
    };
  }

  _checkUpsertId (id, newObject) {
    const updateId = this.getIdsQuery(id, undefined, false);
    Object.keys(updateId).forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(newObject, key)) {
        newObject[key] = updateId[key]; // id is missing in data, we add it
      } else if (newObject[key] !== updateId[key]) {
        throw new errors.BadRequest(`Id '${key}': values mismatch between data '${newObject[key]}' and request '${updateId[key]}'`);
      }
    });
  }

  createQuery (params = {}) {
    const { filters, query } = this.filterQuery(params);
    const q = this._createQuery(params);
    const eagerOptions = { ...this.eagerOptions, ...params.eagerOptions };

    if (this.allowedEager) { q.allowGraph(this.allowedEager); }

    if (params.mergeAllowEager) { q.allowGraph(params.mergeAllowEager); }

    // $select uses a specific find syntax, so it has to come first.
    this._selectQuery(q, filters.$select);

    // $eager for Objection eager queries
    if (query && query.$eager) {
      q.withGraphFetched(query.$eager, eagerOptions);

      delete query.$eager;
    }

    const joinEager = query && query.$joinEager;

    if (joinEager) {
      q.withGraphJoined(query.$joinEager, eagerOptions);

      delete query.$joinEager;
    }

    const joinRelation = query && query.$joinRelation;

    if (joinRelation) {
      q.joinRelated(query.$joinRelation);

      delete query.$joinRelation;
    }

    const leftJoinRelation = query && query.$leftJoinRelation;

    if (leftJoinRelation) {
      q.leftJoinRelated(query.$leftJoinRelation);

      delete query.$leftJoinRelation;
    }
    
    if (query && query.$mergeEager) {
      q[joinEager ? 'withGraphJoined' : 'withGraphFetched'](query.$mergeEager, eagerOptions);

      delete query.$mergeEager;
    }

    if (query && query.$modify) {
      this.modifyQuery(q, query.$modify);

      delete query.$modify;
    }

    if (joinRelation || leftJoinRelation) {
      const groupByColumns = this.getGroupByColumns(q);

      if (!groupByColumns) {
        q.distinct(`${this.Model.tableName}.*`);
      }
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
          this.objectify(builder, eagerFilterQuery, null, null, query.$allowRefs);
        });
      }

      delete query.$modifyEager;
    }

    // build up the knex query out of the query params
    this.objectify(q, query, null, null, query.$allowRefs);

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
  _find (params = {}) {
    const find = (params, count, filters, query) => {
      const q = params.objection || this.createQuery(params);
      const groupByColumns = this.getGroupByColumns(q);

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
        const countColumns = groupByColumns || (Array.isArray(this.id) ? this.id.map(idKey => `${this.Model.tableName}.${idKey}`) : [`${this.Model.tableName}.${this.id}`]);
        const countQuery = this._createQuery(params);

        if (query.$joinRelation) {
          countQuery
            .joinRelated(query.$joinRelation)
            .countDistinct({ total: countColumns });
        } else if (query.$leftJoinRelation) {
          countQuery
            .leftJoinRelated(query.$leftJoinRelation)
            .countDistinct({ total: countColumns });
        } else if (query.$joinEager) {
          countQuery
            .joinRelated(query.$joinEager)
            .countDistinct({ total: countColumns });
        } else if (countColumns.length > 1) {
          countQuery.countDistinct({ total: countColumns });
        } else {
          countQuery.count({ total: countColumns });
        }

        if (query && query.$modify && params.modifierFiltersResults !== false) {
          this.modifyQuery(countQuery, query.$modify);
        }

        this.objectify(countQuery, query, null, null, query.$allowRefs);

        return countQuery
          .then(count => count && count.length ? parseInt(count[0].total, 10) : 0)
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

  _get (id, params = {}) {
    // merge user query with the 'id' to get
    const findQuery = Object.assign({}, { $and: [] }, params.query);
    findQuery.$and.push(this.getIdsQuery(id)); // BUG will fail with composite primary key because table name will be missing

    return this._find(Object.assign({}, params, { query: findQuery }))
      .then(page => {
        const data = page.data || page;

        if (data.length !== 1) {
          throw new errors.NotFound(`No record found for id '${id}'`);
        }

        return data[0];
      });
  }

  _getCreatedRecords (insertResults, inputData, params) {
    if (params.query && params.query.$noSelect) {
      return inputData;
    }
    if (!Array.isArray(insertResults)) {
      insertResults = [insertResults];
    }

    const findQuery = Object.assign({ $and: [] }, params.query);
    const idsQueries = [];

    if (Array.isArray(this.id)) {
      for (const insertResult of insertResults) {
        const ids = [];
        for (const idKey of this.id) {
          if (idKey in insertResult) {
            ids.push(insertResult[idKey]);
          } else {
            return inputData;
          }
        }
        idsQueries.push(this.getIdsQuery(ids));
      }
    } else {
      const ids = [];
      for (const insertResult of insertResults) {
        if (this.id in insertResult) {
          ids.push(insertResult[this.id]);
        } else {
          return inputData;
        }
      }
      idsQueries.push(this.getIdsQuery(null, ids));
    }

    if (idsQueries.length > 1) {
      findQuery.$and.push({ $or: idsQueries });
    } else {
      findQuery.$and = findQuery.$and.concat(idsQueries);
    }

    return this._find(Object.assign({}, params, { query: findQuery }))
      .then(page => {
        const records = page.data || page;
        if (Array.isArray(inputData)) {
          return records;
        }
        return records[0];
      });
  }

  /**
   * @param data
   * @param params
   * @returns {Promise<Object|Object[]>}
   * @private
   */
  _batchInsert (data, params) {
    const { dialect } = this.Model.knex().client;
    // batch insert only works with Postgresql and SQL Server
    if (dialect === 'postgresql' || dialect === 'mssql') {
      return this._createQuery(params)
        .insert(data)
        .returning(this.id);
    }
    if (!Array.isArray(data)) {
      return this._createQuery(params).insert(data);
    }
    const promises = data.map(dataItem => {
      return this._createQuery(params).insert(dataItem);
    });
    return Promise.all(promises);
  }

  /**
   * `create` service function for Objection.
   * @param {object} data
   * @param {object} params
   */
  async _create (data, params = {}) {
    const transaction = await this._createTransaction(params);
    const q = this._createQuery(params);
    let promise = q;
    const allowedUpsert = this.mergeRelations(this.allowedUpsert, params.mergeAllowUpsert);
    const allowedInsert = this.mergeRelations(this.allowedInsert, params.mergeAllowInsert);
    const upsertGraphOptions = { ...this.upsertGraphOptions, ...params.mergeUpsertGraphOptions };
    const insertGraphOptions = { ...this.insertGraphOptions, ...params.mergeInsertGraphOptions };

    if (this.createUseUpsertGraph) {
      if (allowedUpsert) {
        q.allowGraph(allowedUpsert);
      }
      q.upsertGraph(data, upsertGraphOptions);
    } else if (allowedInsert) {
      q.allowGraph(allowedInsert);
      q.insertGraph(data, insertGraphOptions);
    } else {
      promise = this._batchInsert(data, params);
    }
    return promise
      .then(insertResults => this._getCreatedRecords(insertResults, data, params))
      .then(this._commitTransaction(transaction), this._rollbackTransaction(transaction))
      .catch(errorHandler);
  }

  /**
   * `update` service function for Objection.
   * @param id
   * @param data
   * @param params
   */
  _update (id, data, params = {}) {
    // NOTE : First fetch the item to update to account for user query
    return this._get(id, params)
      .then(() => {
        // NOTE: Next, fetch table metadata so
        // that we can fill any existing keys that the
        // client isn't updating with null;
        return this.Model.fetchTableMetadata()
          .then(async meta => {
            let newObject = Object.assign({}, data);
            let transaction = null;

            const allowedUpsert = this.mergeRelations(this.allowedUpsert, params.mergeAllowUpsert);

            if (allowedUpsert) {
              // Ensure the object we fetched is the one we update
              this._checkUpsertId(id, newObject);
              // Create transaction if needed
              transaction = await this._createTransaction(params);
            }

            for (const key of meta.columns) {
              if (newObject[key] === undefined) {
                newObject[key] = null;
              }
            }

            if (allowedUpsert) {
              const upsertGraphOptions = { ...this.upsertGraphOptions, ...params.mergeUpsertGraphOptions };
              return this._createQuery(params)
                .allowGraph(allowedUpsert)
                .upsertGraphAndFetch(newObject, upsertGraphOptions).then(this._commitTransaction(transaction), this._rollbackTransaction(transaction));
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
              .then(() => { // BUG if nothing updated, throw a NotFound
                // NOTE (EK): Restore the id field so we can return it to the client
                if (Array.isArray(this.id)) {
                  newObject = Object.assign({}, newObject, this.getIdsQuery(id));
                } else {
                  newObject[this.id] = id;
                }
                return newObject;
              });
          })
          .then(this._selectFields(params, data));
      })
      .catch(errorHandler);
  }

  /**
   * `patch` service function for Objection.
   * @param id
   * @param data
   * @param params
   */
  _patch (id, data, params = {}) {
    let { filters, query } = this.filterQuery(params);

    const allowedUpsert = this.mergeRelations(this.allowedUpsert, params.mergeAllowUpsert);
    const upsertGraphOptions = { ...this.upsertGraphOptions, ...params.mergeUpsertGraphOptions };
    if (allowedUpsert && id !== null) {
      const dataCopy = Object.assign({}, data);
      this._checkUpsertId(id, dataCopy);

      // Get object first to ensure it satisfy user query
      return this._get(id, params).then(async () => {
        // Create transaction if needed
        const transaction = await this._createTransaction(params);
        return this._createQuery(params)
          .allowGraph(allowedUpsert)
          .upsertGraphAndFetch(dataCopy, upsertGraphOptions)
          .then(this._selectFields(params, data)).then(this._commitTransaction(transaction), this._rollbackTransaction(transaction));
      });
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

    this.objectify(q, query, null, null, query.$allowRefs);

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

        // Update find query if needed with patched values
        const updateKeys = (obj) => {
          for (const key of Object.keys(obj)) {
            if (key in dataCopy) {
              obj[key] = dataCopy[key];
            } else {
              if (Array.isArray(obj[key])) {
                obj[key].forEach(obj => updateKeys(obj));
              }
            }
          }
        };
        updateKeys(findParams.query);

        return q.patch(dataCopy).then(() => {
          return params.query && params.query.$noSelect
            ? dataCopy
            : this._find(findParams).then(page => {
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
  _remove (id, params = {}) {
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

    this.objectify(query, queryParams, null, null, query.$allowRefs);

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
