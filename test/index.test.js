/* eslint-env mocha */
/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import assert from 'assert';
import feathers from '@feathersjs/feathers';
import knex from 'knex';
import adapterTests from '@feathersjs/adapter-tests';
import errors from '@feathersjs/errors';
import service, { ERROR } from '../src';
import errorHandler from '../src/error-handler';
import People from './people';
import PeopleCustomid from './people-customid';
import PeopleRoom from './people-rooms';
import PeopleRoomsCustomIdSeparator from './people-rooms-custom-id-separator';
import Company from './company';
import Employee from './employee';
import Client from './client';
import {
  CheckViolationError,
  ConstraintViolationError,
  DataError,
  DBError,
  ForeignKeyViolationError,
  Model,
  NotFoundError,
  NotNullViolationError,
  UniqueViolationError,
  ValidationError
} from 'objection';

const testSuite = adapterTests([
  '.options',
  '.events',
  '._get',
  '._find',
  '._create',
  '._update',
  '._patch',
  '._remove',
  '.get',
  '.get + $select',
  '.get + id + query',
  '.get + NotFound',
  '.get + id + query id',
  '.find',
  '.remove',
  '.remove + $select',
  '.remove + id + query',
  // '.remove + id + query id', // TODO: check why it's failing
  '.remove + multi',
  '.update',
  '.update + $select',
  '.update + id + query',
  '.update + id + query id',
  '.update + NotFound',
  '.update + query + NotFound',
  '.patch',
  '.patch + $select',
  '.patch + id + query',
  '.patch + id + query id',
  '.patch multiple',
  '.patch multi query same',
  '.patch multi query changed',
  '.patch + NotFound',
  '.patch + query + NotFound',
  '.create',
  '.create + $select',
  '.create multi',
  'internal .find',
  'internal .get',
  'internal .create',
  'internal .update',
  'internal .patch',
  'internal .remove',
  '.find + equal',
  '.find + equal multiple',
  '.find + $sort',
  '.find + $sort + string',
  '.find + $limit',
  '.find + $limit 0',
  '.find + $skip',
  '.find + $select',
  '.find + $or',
  '.find + $in',
  '.find + $nin',
  '.find + $lt',
  '.find + $lte',
  '.find + $gt',
  '.find + $gte',
  '.find + $ne',
  '.find + $gt + $lt + $sort',
  '.find + $or nested + $sort',
  '.find + paginate',
  '.find + paginate + $limit + $skip',
  '.find + paginate + $limit 0',
  '.find + paginate + params'
]);

const db = knex({
  client: 'sqlite3',
  debug: false,
  connection: {
    filename: './db.sqlite'
  },
  useNullAsDefault: false
});

// Bind Objection.js
Model.knex(db);

const app = feathers()
  .use(
    '/people',
    service({
      model: People,
      id: 'id',
      multi: ['create'],
      whitelist: ['$and', '$like', '$between', '$notBetween', '$null', '$noSelect'],
      events: ['testing']
    })
  )
  .use(
    '/people-customid',
    service({
      model: PeopleCustomid,
      id: 'customid',
      events: ['testing']
    })
  )
  .use(
    '/people-rooms',
    service({
      model: PeopleRoom,
      id: ['peopleId', 'roomId'],
      multi: ['create', 'patch'],
      events: ['testing']
    })
  )
  .use(
    '/people-rooms-custom-id-separator',
    service({
      model: PeopleRoomsCustomIdSeparator,
      id: ['peopleId', 'roomId'],
      idSeparator: '.',
      multi: ['create'],
      events: ['testing']
    })
  )
  .use(
    '/companies',
    service({
      model: Company,
      id: 'id',
      multi: ['create', 'remove', 'patch'],
      whitelist: ['$eager', '$joinEager', '$joinRelation', '$modifyEager', '$mergeEager', '$between', '$notBetween', '$containsKey', '$contains', '$contained', '$any', '$all', '$noSelect', '$like', '$null', '$modify', '$allowRefs'],
      allowedEager: '[ceos, clients, employees]',
      eagerFilters: [
        {
          expression: 'ceos',
          filter: function youngCEOs (builder) {
            return builder.where('age', '<', '25');
          }
        }
      ],
      allowedInsert: 'clients',
      allowedUpsert: 'clients',
      events: ['testing']
    })
  )
  .use(
    '/employees',
    service({
      model: Employee,
      multi: ['create'],
      whitelist: ['$eager', '$joinRelation', '$joinEager', '$like', '$allowRefs'],
      allowedEager: 'company',
      eagerFilters: {
        expression: 'ltd',
        filter: function ltd (builder) {
          return builder.where('name', 'like', '% ltd');
        }
      },
      events: ['testing']
    })
  )
  .use(
    '/clients',
    service({
      model: Client,
      multi: ['remove'],
      allowedEager: 'company',
      events: ['testing']
    })
  );

const people = app.service('people');
const peopleRooms = app.service('people-rooms');
const peopleRoomsCustomIdSeparator = app.service('people-rooms-custom-id-separator');
const companies = app.service('companies');
const employees = app.service('employees');
const clients = app.service('clients');

function clean (done) {
  db.schema
    .dropTableIfExists('people')
    .then(() => {
      return db.schema.createTable('people', table => {
        table.increments('id');
        table.string('name');
        table.integer('age');
        table.integer('time');
        table.boolean('created');
      });
    })
    .then(() => {
      return db.schema.dropTableIfExists('people-customid').then(() => {
        return db.schema.createTable('people-customid', table => {
          table.increments('customid');
          table.string('name');
          table.integer('age');
          table.integer('time');
          table.boolean('created');
        });
      });
    })
    .then(() => {
      return db.schema.dropTableIfExists('people-rooms').then(() => {
        return db.schema.createTable('people-rooms', table => {
          table.integer('peopleId');
          table.integer('roomId');
          table.boolean('admin');
          table.primary(['peopleId', 'roomId']);
        });
      });
    })
    .then(() => {
      return db.schema.dropTableIfExists('people-rooms-custom-id-separator').then(() => {
        return db.schema.createTable('people-rooms-custom-id-separator', table => {
          table.integer('peopleId');
          table.integer('roomId');
          table.boolean('admin');
          table.primary(['peopleId', 'roomId']);
        });
      });
    })
    .then(() => {
      return db.schema.dropTableIfExists('clients').then(() => {
        return db.schema.dropTableIfExists('employees').then(() => {
          return db.schema.dropTableIfExists('companies').then(() => {
            return db.schema.createTable('companies', table => {
              table.increments('id');
              table.string('name');
              table.integer('ceo');
              table.enum('size', ['small', 'medium', 'large']);
              table.json('jsonObject');
              table.json('jsonArray');
              table.jsonb('jsonbObject');
              table.jsonb('jsonbArray');
              table.unique('name');
            });
          });
        });
      });
    })
    .then(() => {
      return db.schema.dropTableIfExists('employees').then(() => {
        return db.schema
          .createTable('employees', table => {
            table.increments('id');
            table.integer('companyId');
            table.string('name');
          });
      });
    })
    .then(() => {
      return db.schema.dropTableIfExists('clients').then(() => {
        return db.schema
          .createTable('clients', table => {
            table.increments('id');
            table.integer('companyId');
            table.string('name');
            table.unique('name');
          })
          .then(() => done());
      });
    });
}

describe('Feathers Objection Service', () => {
  before(clean);
  after(clean);

  describe('Initialization', () => {
    describe('when missing a Model', () => {
      it('throws an error', () => {
        expect(service.bind(null, {})).to.throw(
          /You must provide an Objection Model/
        );
      });
    });

    describe('when missing the id option', () => {
      it('sets the default to be id', () => {
        expect(people.id).to.equal('id');
      });
    });

    describe('when missing the paginate option', () => {
      it('sets the default to be undefined', () => {
        expect(people.paginate).to.equal(undefined);
      });
    });

    describe('when missing allowedEager', () => {
      it('sets the default to be undefined', () => {
        expect(people.allowedEager).to.equal(undefined);
      });
    });

    describe('when missing eagerFilters', () => {
      it('sets the default to be undefined', () => {
        expect(people.eagerFilters).to.equal(undefined);
      });
    });
  });

  describe('error handler', () => {
    it('no error code', () => {
      const error = new Error('Unknown Error');
      expect(errorHandler.bind(null, error)).to.throw('Unknown Error');
      expect(errorHandler.bind(null, error)).to.throw(errors.GeneralError);
    });

    it('Get original error', () => {
      const error = new Error();
      error.code = 'SQLITE_ERROR';
      error.errno = 999;

      try {
        errorHandler(error);
      } catch (err) {
        expect(err[ERROR]).to.deep.equal(error);
      }
    });

    describe('Error Mappings', () => {
      it('Unknown error', () => {
        const error = new Error();
        expect(errorHandler.bind(null, error)).to.throw(errors.GeneralError);
      });

      it('Validation error', () => {
        const validationErrTypes = ['ModelValidation', 'RelationExpression', 'UnallowedRelation', 'InvalidGraph', 'unknown-thing'];
        for (const type of validationErrTypes) {
          const error = new ValidationError({ type });
          expect(errorHandler.bind(null, error)).to.throw(errors.BadRequest);
        }
      });

      it('NotFound error', () => {
        const error = new NotFoundError();
        expect(errorHandler.bind(null, error)).to.throw(errors.NotFound);
      });

      it('UniqueViolation error', () => {
        const error = new UniqueViolationError({
          nativeError: new Error(),
          client: 'sqlite',
          table: 'tableName',
          columns: ['columnName']
        });

        expect(errorHandler.bind(null, error)).to.throw(errors.Conflict);
      });

      it('UniqueViolation error mysql', () => {
        const error = new UniqueViolationError({
          nativeError: { sqlMessage: 'test' },
          client: 'mysql',
          table: undefined,
          columns: undefined,
          constraint: 'test_constraint'
        });

        expect(errorHandler.bind(null, error)).to.throw(error.Conflict, 'test');
      });

      it('ConstraintViolation error', () => {
        const error = new ConstraintViolationError({
          nativeError: new Error(),
          client: 'sqlite'
        });

        expect(errorHandler.bind(null, error)).to.throw(errors.Conflict);
      });

      it('NotNullViolation error', () => {
        const error = new NotNullViolationError({
          nativeError: new Error(),
          client: 'sqlite',
          column: 'columnName'
        });

        expect(errorHandler.bind(null, error)).to.throw(errors.BadRequest);
      });

      it('ForeignKeyViolation error', () => {
        const error = new ForeignKeyViolationError({
          nativeError: new Error(),
          client: 'sqlite'
        });

        expect(errorHandler.bind(null, error)).to.throw(errors.Conflict);
      });

      it('CheckViolation error', () => {
        const error = new CheckViolationError({
          nativeError: new Error(),
          client: 'sqlite'
        });

        expect(errorHandler.bind(null, error)).to.throw(errors.BadRequest);
      });

      it('Data error', () => {
        const error = new DataError({
          nativeError: new Error(),
          client: 'sqlite'
        });

        expect(errorHandler.bind(null, error)).to.throw(errors.BadRequest);
      });

      it('Database error', () => {
        const error = new DBError({
          nativeError: new Error(),
          client: 'sqlite'
        });

        expect(errorHandler.bind(null, error)).to.throw(errors.GeneralError);
      });
    });
  });

  describe('Common Tests', () => {
    it('is CommonJS compatible', () =>
      assert.strictEqual(typeof require('../lib'), 'function'));

    testSuite(app, errors, 'people', 'id');
    testSuite(app, errors, 'people-customid', 'customid');
  });

  describe('Composite PK queries', () => {
    beforeEach(async () => {
      await peopleRooms
        .create([
          {
            peopleId: 1,
            roomId: 1,
            admin: true
          },
          {
            peopleId: 1,
            roomId: 2,
            admin: false
          },
          {
            peopleId: 2,
            roomId: 2,
            admin: true
          }
        ]);

      await peopleRoomsCustomIdSeparator
        .create([
          {
            peopleId: 1,
            roomId: 2,
            admin: false
          },
          {
            peopleId: 2,
            roomId: 2,
            admin: true
          }
        ]);
    });

    afterEach(async () => {
      try {
        await peopleRooms.remove([1, 1]);
      } catch (err) {}
      try {
        await peopleRooms.remove([1, 2]);
      } catch (err) {}
      try {
        await peopleRooms.remove([2, 2]);
      } catch (err) {}
      try {
        await peopleRoomsCustomIdSeparator.remove([1, 2]);
      } catch (err) {}
      try {
        await peopleRoomsCustomIdSeparator.remove([2, 2]);
      } catch (err) {}
    });

    it('allows get queries', () => {
      return peopleRooms.get([2, 2]).then(data => {
        expect(data.peopleId).to.equal(2);
        expect(data.roomId).to.equal(2);
        expect(data.admin).to.equal(1);
      });
    });

    it('allows get queries by object', () => {
      return peopleRooms.get({ peopleId: 2, roomId: 2 }).then(data => {
        expect(data.peopleId).to.equal(2);
      });
    });

    it('allows get queries by separator', () => {
      return peopleRooms.get('2,2').then(data => {
        expect(data.peopleId).to.equal(2);
      });
    });

    it('allows get queries by custom separator', () => {
      return peopleRoomsCustomIdSeparator.get('2.2').then(data => {
        expect(data.peopleId).to.equal(2);
      });
    });

    it('allows get queries by array in string', () => {
      return peopleRoomsCustomIdSeparator.get('[2, 2]').then(data => {
        expect(data.peopleId).to.equal(2);
      });
    });

    it('allows get queries by object in string', () => {
      return peopleRoomsCustomIdSeparator.get('{ "peopleId": 2, "roomId": 2 }').then(data => {
        expect(data.peopleId).to.equal(2);
      });
    });

    it('get with partial id in string throws an error', () => {
      return peopleRooms.update('2', { admin: false }).then(() => {
        throw new Error('Should never get here');
      }).catch(function (error) {
        expect(error).to.be.ok;
        expect(error instanceof errors.BadRequest).to.be.ok;
        expect(error.message).to.equal('When using composite primary key, id must contain values for all primary keys');
      });
    });

    it('allows find queries', () => {
      return peopleRooms.find({ query: { roomId: 2 } }).then(data => {
        expect(data.length).to.equal(2);
        expect(data[0].peopleId).to.equal(1);
        expect(data[1].peopleId).to.equal(2);
      });
    });

    it('allows update queries', () => {
      return peopleRooms.update([2, 2], { admin: false, peopleId: 1 }).then(data => {
        expect(data.peopleId).to.equal(2);
        expect(data.admin).to.equal(false);
      });
    });

    it('update multiple records throws an error', () => {
      return peopleRooms.update([2, 2], [{ admin: false }]).then(() => {
        throw new Error('Should never get here');
      }).catch(function (error) {
        expect(error).to.be.ok;
        expect(error instanceof errors.BadRequest).to.be.ok;
        expect(error.message).to.equal('You can not replace multiple instances. Did you mean \'patch\'?');
      });
    });

    it('update with partial id throws an error', () => {
      return peopleRooms.update([2], { admin: false }).then(() => {
        throw new Error('Should never get here');
      }).catch(function (error) {
        expect(error).to.be.ok;
        expect(error instanceof errors.BadRequest).to.be.ok;
        expect(error.message).to.equal('When using composite primary key, id must contain values for all primary keys');
      });
    });

    it('allows patch queries', () => {
      return peopleRooms.patch([2, 2], { admin: false, peopleId: 1 }).then(data => {
        expect(data.peopleId).to.equal(2);
        expect(data.admin).to.equal(0);
      });
    });

    it('patch multiple records', () => {
      return peopleRooms.patch(null, { admin: true }).then(data => {
        expect(data).to.be.instanceof(Array);
        expect(data.length).to.equal(3);
      });
    });

    it('allows patch multiple records with patched keys in complex query', () => {
      return peopleRooms.patch(null, { admin: false }, { query: { $and: [{ admin: true }] } }).then(data => {
        expect(data).to.be.instanceof(Array);
        expect(data.length).to.equal(3);
      });
    });

    it('patch with partial id throws an error', () => {
      return peopleRooms.patch([2], { admin: false }).then(() => {
        throw new Error('Should never get here');
      }).catch(function (error) {
        expect(error).to.be.ok;
        expect(error instanceof errors.BadRequest).to.be.ok;
        expect(error.message).to.equal('When using composite primary key, id must contain values for all primary keys');
      });
    });

    it('patch with id and no results throws an error', () => {
      return peopleRooms.patch([999, 999], { admin: false }).then(() => {
        throw new Error('Should never get here');
      }).catch(function (error) {
        expect(error).to.be.ok;
        expect(error instanceof errors.NotFound).to.be.ok;
        expect(error.message).to.equal('No record found for id \'999,999\'');
      });
    });

    it('patch with invalid id', () => {
      return peopleRooms.patch(false, { admin: false }).then(() => {
        throw new Error('Should never get here');
      }).catch(function (error) {
        expect(error).to.be.ok;
        expect(error instanceof errors.NotFound).to.be.ok;
        expect(error.message).to.equal('No record found for id \'false\'');
      });
    });

    it('allows remove queries', () => {
      return peopleRooms.remove([2, 2]).then(() => {
        return peopleRooms.find().then(data => {
          expect(data.length).to.equal(2);
        });
      });
    });

    it('allows get queries with $select', () => {
      return peopleRooms.get([2, 2], { query: { $select: ['admin'] } }).then(data => {
        expect(data.admin).to.equal(1);
      });
    });

    it('allows find queries with $select', () => {
      return peopleRooms.find({ query: { roomId: 2, $select: ['admin'] } }).then(data => {
        expect(data.length).to.equal(2);
        expect(data[0].admin).to.equal(0);
        expect(data[1].admin).to.equal(1);
      });
    });
  });

  describe('Eager queries', () => {
    const ids = {};

    before(async () => {
      ids.ceo = await people
        .create({
          name: 'Snoop',
          age: 20
        });

      ids.companies = await companies
        .create([
          {
            name: 'Google',
            ceo: ids.ceo.id
          },
          {
            name: 'Apple',
            ceo: ids.ceo.id
          }
        ]);

      ids.employees = await employees
        .create([
          {
            name: 'John',
            companyId: 1
          },
          {
            name: 'John',
            companyId: 1
          },
          {
            name: 'Dan',
            companyId: 1
          }
        ]);
    });

    after(async () => {
      await people.remove(ids.ceo.id);

      for (const employee of ids.employees) { await employees.remove(employee.id); }

      for (const company of ids.companies) { await companies.remove(company.id); }
    });

    it('allows eager queries', () => {
      return companies.find({ query: { $eager: 'ceos' } }).then(data => {
        expect(data[0].ceos).to.be.ok;
      });
    });

    it('allows mergeAllowEager queries', () => {
      return companies.find({ query: { $eager: 'employees' }, mergeAllowEager: 'employees' }).then(data => {
        expect(data[0].employees).to.be.ok;
      });
    });

    it('allows mergeEager queries', () => {
      return companies.find({ query: { $eager: 'employees', $mergeEager: 'ceos' }, mergeAllowEager: '[employees, ceos]' }).then(data => {
        expect(data[0].employees).to.be.ok;
        expect(data[0].ceos).to.be.ok;
      });
    });

    it('allows mergeEager queries with joinEager', () => {
      return companies.find({ query: { $joinEager: 'employees', $mergeEager: 'ceos', 'employees.name': { $like: '%' } }, mergeAllowEager: '[employees, ceos]' }).then(data => {
        expect(data[0].employees).to.be.ok;
        expect(data[0].ceos).to.be.ok;
      });
    });

    it('allows modifyEager queries', () => {
      return companies.find({ query: { $eager: 'employees', $modifyEager: { employees: { name: 'John' } } }, mergeAllowEager: 'employees' }).then(data => {
        expect(data[0].employees.length).to.equal(2);
        expect(data[1].employees.length).to.equal(0);
      });
    });

    it('allows eager queries with named filters', () => {
      return companies
        .find({ query: { $eager: 'ceos(notSnoop)' } })
        .then(data => {
          expect(data[0].ceos).to.be.null;
        });
    });

    it('disallow eager queries', () => {
      return people
        .find({ query: { $eager: 'company' } })
        .then(data => {
          throw new Error('Should not reach here');
        })
        .catch(error => {
          expect(error.code).to.equal(400);
        });
    });
  });

  describe('Join Eager/Relation queries', () => {
    const ids = {};

    before(async () => {
      ids.ceo = await people
        .create({
          name: 'Snoop',
          age: 20
        });

      ids.companies = await companies
        .create([
          {
            name: 'Google',
            ceo: ids.ceo.id
          },
          {
            name: 'Apple',
            ceo: ids.ceo.id
          }
        ]);

      const [google, apple] = ids.companies;

      ids.employees = await employees
        .create([
          {
            name: 'D',
            companyId: google.id
          },
          {
            name: 'C',
            companyId: google.id
          },
          {
            name: 'B',
            companyId: apple.id
          },
          {
            name: 'A',
            companyId: apple.id
          }
        ]);
    });

    after(async () => {
      await people.remove(ids.ceo.id);

      for (const employee of ids.employees) { await employees.remove(employee.id); }

      for (const company of ids.companies) { await companies.remove(company.id); }
    });

    afterEach(async () => {
      employees.options.paginate = {};
    });

    it('allows joinEager queries', () => {
      return employees.find({ query: { $joinEager: 'company' } }).then(data => {
        expect(data[0].company).to.be.ok;
        expect(data[1].company).to.be.ok;
      });
    });

    it('allows filtering by relation field with joinEager queries', () => {
      return employees
        .find({
          query: {
            $joinEager: 'company',
            'company.name': {
              $like: 'Google'
            }
          }
        })
        .then(data => {
          expect(data.length).to.equal(2);
          expect(data[0].company.name).to.equal('Google');
        });
    });

    it('allows filtering by relation field with paginate joinEager queries', () => {
      employees.options.paginate = {
        default: 1,
        max: 2
      };
      return employees
        .find({
          query: {
            $joinEager: 'company',
            'company.name': {
              $like: 'Google'
            }
          }
        })
        .then(data => {
          expect(data.total).to.be.equal(2);
          expect(data.data.length).to.equal(1);
          expect(data.data[0].company.name).to.equal('Google');
        });
    });

    it('allows joinRelation queries and eager', () => {
      return employees
        .find({
          query: {
            $eager: 'company',
            $joinRelation: 'company'
          }
        })
        .then(data => {
          expect(data[0].company).to.be.ok;
          expect(data[1].company).to.be.ok;
        });
    });

    it('allows filtering by relation field with joinRelation queries', () => {
      return employees
        .find({
          query: {
            $joinRelation: 'company',
            'company.name': {
              $like: 'Google'
            },
            $sort: {
              'employees.name': 1
            }
          }
        })
        .then(data => {
          expect(data.length).to.equal(2);
          expect(data[0].name).to.equal('C');
        });
    });

    it('allows filtering by relation field with joinRelation queries and eager', () => {
      return employees
        .find({
          query: {
            $eager: 'company',
            $joinRelation: 'company',
            'company.name': {
              $like: 'Google'
            }
          }
        })
        .then(data => {
          expect(data.length).to.equal(2);
          expect(data[0].company.name).to.equal('Google');
        });
    });

    it('allows joinRelation queries, eager with sort by relation', () => {
      return employees
        .find({
          query: {
            $select: ['employees.*', 'company.name'],
            $eager: 'company',
            $joinRelation: 'company',
            $sort: {
              'employees.name': 1,
              'company.name': 1
            }
          }
        })
        .then(data => {
          expect(data.length).to.equal(4);
          expect(data[0].name).to.equal('A');
          expect(data[0].company.name).to.equal('Apple');
        });
    });

    it('allows joinRelation queries, eager with sort and sorted relation', () => {
      return employees
        .find({
          query: {
            $select: ['employees.*', 'company.name'],
            $eager: 'company(orderByName)',
            $joinRelation: 'company',
            $sort: {
              'employees.name': 1
            }
          }
        })
        .then(data => {
          expect(data.length).to.equal(4);
          expect(data[0].name).to.equal('A');
          expect(data[0].company.name).to.equal('Apple');
        });
    });
  });

  describe('Graph Insert Queries', () => {
    before(async () => {
      await companies
        .create([
          {
            name: 'Google',
            clients: [
              {
                name: 'Dan Davis'
              },
              {
                name: 'Ken Patrick'
              }
            ]
          },
          {
            name: 'Apple'
          }
        ]);
    });

    after(async () => {
      await clients.remove(null);
      await companies.remove(null);
    });

    it('allows insertGraph queries', () => {
      return companies.find({ query: { $eager: 'clients' } }).then(data => {
        expect(data[0].clients).to.be.an('array');
        expect(data[0].clients).to.have.lengthOf(2);
      });
    });

    it('allows mergeAllowInsert queries', () => {
      return companies.create({ name: 'Compaq', ceos: { name: 'Rod Canion', age: 24 } }, { mergeAllowInsert: 'ceos' }).then(() => {
        return companies.find({ query: { name: 'Compaq', $eager: 'ceos' } }).then(data => {
          expect(data[0].ceos).to.be.ok;
          expect(data[0].ceos.name).to.equal('Rod Canion');
        });
      });
    });

    it('allows createUseUpsertGraph queries', () => {
      companies.createUseUpsertGraph = true;

      return companies
        .create([
          {
            name: 'Facebook',
            clients: [
              {
                name: 'Danny Lapierre'
              },
              {
                name: 'Kirck Filty'
              }
            ]
          },
          {
            name: 'Yubico'
          }
        ]).then(() => {
          companies.createUseUpsertGraph = false;

          return companies.find({ query: { $eager: 'clients' } }).then(data => {
            expect(data[0].clients).to.be.an('array');
            expect(data[0].clients).to.have.lengthOf(2);
          });
        });
    });
  });

  describe('Graph Upsert Queries', () => {
    let ceo;
    let google;
    let apple;

    beforeEach(async () => {
      ceo = await people
        .create({
          name: 'Snoop',
          age: 20
        });

      [google, apple] = await companies
        .create([
          {
            name: 'Google',
            ceo: ceo.id,
            clients: [
              {
                name: 'Dan Davis'
              }
            ]
          },
          {
            name: 'Apple'
          }
        ], { query: { $eager: 'clients' } });
    });

    afterEach(async () => {
      const persons = await people.find();

      for (const person of persons) { await people.remove(person.id); }

      await clients.remove(null);
      await companies.remove(null);
    });

    it('allows upsertGraph queries on update', () => {
      const newClients = (google.clients)
        ? google.clients.concat([{
            name: 'Ken Patrick'
          }])
        : [];

      return companies
        .update(google.id, {
          name: 'Alphabet',
          clients: newClients
        }).then(() => { // NOTE: Do not need $eager anymore
          return companies.find({ query: { $eager: 'clients' } }).then(data => {
            expect(data[0].name).equal('Alphabet');
            expect(data[0].clients).to.be.an('array');
            expect(data[0].clients).to.have.lengthOf(2);
          });
        });
    });

    it('forbid upsertGraph if data do not match update item', () => {
      const newClients = (google.clients)
        ? google.clients.concat([{
            name: 'Ken Patrick'
          }])
        : [];

      return companies
        .update(apple.id, {
          id: google.id,
          name: 'Alphabet',
          clients: newClients
        }).then(() => {
          throw new Error('Should never get here');
        }).catch(function (error) {
          expect(error).to.be.ok;
          expect(error instanceof errors.BadRequest).to.be.ok;
        });
    });

    it('forbid upsertGraph if data do not match patch item', () => {
      const newClients = (google.clients)
        ? google.clients.concat([{
            name: 'Ken Patrick'
          }])
        : [];

      return companies
        .patch(apple.id, {
          id: google.id,
          name: 'Alphabet',
          clients: newClients
        }).then(() => {
          throw new Error('Should never get here');
        }).catch(function (error) {
          expect(error).to.be.ok;
          expect(error instanceof errors.BadRequest).to.be.ok;
        });
    });

    it('allows upsertGraph queries on patch', () => {
      const newClients = (google.clients)
        ? google.clients.concat([{
            name: 'Ken Patrick'
          }])
        : [];

      return companies
        .patch(google.id, {
          name: 'Google Alphabet',
          clients: newClients
        }).then(data => {
          expect(data.name).equal('Google Alphabet');
          expect(data.ceo).equal(ceo.id);

          return companies.find({ query: { $eager: 'clients' } }).then(data => {
            expect(data[0].name).equal('Google Alphabet');
            expect(data[0].clients).to.be.an('array');
            expect(data[0].clients).to.have.lengthOf(2);
          });
        });
    });

    it('allows upsertGraph queries on patch with query param', () => {
      const newClients = (google.clients)
        ? google.clients.concat([{
            name: 'Ken Patrick'
          }])
        : [];

      return companies
        .patch(google.id, {
          name: 'Google Alphabet',
          clients: newClients
        }, { query: { name: 'microsoft' } }).then(() => {
          throw new Error('Should never get here');
        }).catch(function (error) {
          expect(error).to.be.ok;
          expect(error instanceof errors.NotFound).to.be.ok;
        });
    });

    it('allows mergeAllowUpsert queries', () => {
      return companies.patch(google.id, { ceos: { id: ceo.id, name: 'Dog' } }, { mergeAllowUpsert: 'ceos' }).then(data => {
        expect(data.ceos.name).to.equal('Dog');

        return companies.get(google.id, { query: { $eager: 'ceos' } }).then(data => {
          expect(data.ceos.name).to.equal('Dog');
        });
      });
    });
  });

  describe('$like method', () => {
    before(async () => {
      await people
        .create({
          name: 'Charlie Brown',
          age: 10
        });
    });

    it('$like in query', () => {
      return people.find({ query: { name: { $like: '%lie%' } } }).then(data => {
        expect(data[0].name).to.be.equal('Charlie Brown');
      });
    });
  });

  describe('$and method', () => {
    before(async () => {
      await people
        .create([
          {
            name: 'Dave',
            age: 23
          },
          {
            name: 'Dave',
            age: 32
          },
          {
            name: 'Dada',
            age: 1
          }
        ]);
    });

    it('$and in query', () => {
      return people.find({ query: { $and: [{ $or: [{ name: 'Dave' }, { name: 'Dada' }] }, { age: { $lt: 23 } }] } }).then(data => {
        expect(data[0].name).to.be.equal('Dada');
      });
    });
  });

  describe('$or method', () => {
    before(async () => {
      await people
        .create([
          {
            name: 'Dave',
            age: 23
          },
          {
            name: 'Dave',
            age: 32
          },
          {
            name: 'Dada',
            age: 1
          }
        ]);
    });

    it('$or in query', () => {
      return people.find({ query: { $or: [{ name: 'John' }, { name: 'Dada' }] } }).then(data => {
        expect(data[0].name).to.be.equal('Dada');
      });
    });
  });

  describe('$not method', () => {
    before(async () => {
      const persons = await people.find();

      for (const person of persons) { await people.remove(person.id); }

      await people
        .create([
          {
            name: 'John',
            age: 23
          },
          {
            name: 'Dave',
            age: 32
          },
          {
            name: 'Dada',
            age: 1
          }
        ]);
    });

    it('$not in query', () => {
      return people.find({ query: { $not: { name: 'John' } } }).then(data => {
        expect(data.length).to.be.equal(2);
        expect(data[0].name).to.be.equal('Dave');
      });
    });

    it('$not with implicit $and in query', () => {
      return people.find({ query: { $not: [{ name: 'John' }, { name: 'Dave' }] } }).then(data => {
        expect(data.length).to.be.equal(3);
        expect(data[0].name).to.be.equal('John');
      });
    });

    it('$not with $and in query', () => {
      return people.find({ query: { $not: { $and: [{ name: 'John' }, { name: 'Dave' }] } } }).then(data => {
        expect(data.length).to.be.equal(3);
        expect(data[0].name).to.be.equal('John');
      });
    });

    it('$not with $or in query', () => {
      return people.find({ query: { $not: { $or: [{ name: 'John' }, { name: 'Dave' }] } } }).then(data => {
        expect(data.length).to.be.equal(1);
        expect(data[0].name).to.be.equal('Dada');
      });
    });

    it('$not with $null in query', () => {
      return people.find({ query: { $not: { name: { $null: true } } } }).then(data => {
        expect(data.length).to.be.equal(3);
      });
    });
  });

  describe('select with mutating methods', () => {
    it('$select with aliases and update', async () => {
      const p = await people
        .create(
          {
            name: 'Dave',
            age: 1
          }
        );
      return people.update(p.id, { age: 3, name: 'John' }, { query: { $select: ['people.name as n'] } }).then(data => {
        expect(data.n).to.be.equal('John');
        expect(data.age).to.be.equal(undefined);
      });
    });

    it('$select and update upsert', async () => {
      const p = await people
        .create(
          {
            name: 'Dave',
            age: 1
          }
        );
      return people.update(p.id, { id: p.id, age: 3, name: 'John' }, { query: { $select: ['people.age', 'people.name'] }, mergeAllowUpsert: 'company' }).then(data => {
        expect(data.name).to.be.equal('John');
        expect(data.age).to.be.equal(3);
      });
    });

    // it.todo('$select and update upsert with relation fetching');

    it('$select and patch', async () => {
      const p = await people
        .create(
          {
            name: 'Dave',
            age: 1
          }
        );
      return people.patch(p.id, { name: 'John' }, { query: { $select: ['name as n'] } }).then(data => {
        expect(data.n).to.be.equal('John');
        expect(data.age).to.be.equal(undefined);
      });
    });

    it('$select all and patch upsert', async () => {
      const p = await people
        .create(
          {
            name: 'Dave',
            age: 1
          }
        );
      return people.patch(p.id, { name: 'John' }, { query: { $select: ['people.*'] }, mergeAllowUpsert: 'company' }).then(data => {
        expect(data.name).to.be.equal('John');
        expect(data.age).to.be.equal(1);
      });
    });

    it('$select and patch upsert', async () => {
      const p = await people
        .create(
          {
            name: 'Dave',
            age: 1
          }
        );
      return people.patch(p.id, { id: p.id, name: 'John' }, { query: { $select: ['age'] }, mergeAllowUpsert: 'company' }).then(data => {
        expect(data.name).to.be.equal(undefined);
        expect(data.age).to.be.equal(1);
      });
    });

    it('$noSelect and patch', async () => {
      const p = await people
        .create(
          {
            name: 'Dave',
            age: 1
          }
        );
      return people.patch(p.id, { name: 'John' }, { query: { $noSelect: true, $select: ['name as n'] } }).then(data => {
        expect(data.name).to.be.equal('John');
        expect(data.n).to.be.equal(undefined);
        expect(data.age).to.be.equal(undefined);
      });
    });

    it('$noSelect and update', async () => {
      const p = await people
        .create(
          {
            name: 'Dave',
            age: 1
          }
        );
      return people.update(p.id, { age: 3, name: 'John' }, { query: { $noSelect: true, $select: ['name as n'] } }).then(data => {
        expect(data.n).to.be.equal(undefined);
        expect(data.age).to.be.equal(3);
      });
    });
  });

  describe('between & not between operators', () => {
    before(async () => {
      await people
        .create([
          {
            name: 'Dave',
            age: 1
          },
          {
            name: 'John',
            age: 101
          },
          {
            name: 'Dada',
            age: 15
          }
        ]);
    });

    it('$between', () => {
      return people.find({ query: { age: { $between: [100, 102] } } }).then(data => {
        expect(data[0].name).to.be.equal('John');
      });
    });

    it('$between - string', () => {
      return people.find({ query: { age: { $between: '[100, 102]' } } }).then(data => {
        expect(data[0].name).to.be.equal('John');
      });
    });

    it('$notBetween', () => {
      return people.find({ query: { age: { $notBetween: [0, 100] } } }).then(data => {
        expect(data[0].name).to.be.equal('John');
      });
    });

    it('not Between using $not', () => {
      return people.find({ query: { age: { $not: { $between: [0, 100] } } } }).then(data => {
        expect(data[0].name).to.be.equal('John');
      });
    });

    it('$notBetween - string', () => {
      return people.find({ query: { age: { $notBetween: '[0, 100]' } } }).then(data => {
        expect(data[0].name).to.be.equal('John');
      });
    });
  });

  describe('JSON column (SQLite)', () => {
    before(async () => {
      await companies
        .create([
          {
            name: 'Google',
            jsonObject: {
              numberField: 1.5,
              objectField: {
                object: 'string in jsonObject.objectField.object'
              }
            },
            jsonArray: [
              {
                objectField: {
                  object: 'I\'m string in jsonArray[0].objectField.object'
                }
              }
            ]
          }
        ]);
    });

    after(async () => {
      await companies.remove(null);
    });

    it('object', () => {
      return companies.find({ query: { jsonObject: { $ne: null } } }).then(data => {
        expect(data[0].jsonObject.numberField).to.equal(1.5);
      });
    });

    it('object numberField', () => {
      return companies.find({ query: { jsonObject: { numberField: 1.5 } } }).then(() => {
        throw new Error('Should never get here');
      }).catch(function (error) {
        expect(error).to.be.ok;
        expect(error instanceof errors.GeneralError).to.be.ok;
        expect(error[ERROR].message).to.equal('select `companies`.* from `companies` where CAST(`companies`.`jsonObject`#>>\'{numberField}\' AS text) = 1.5 - SQLITE_ERROR: unrecognized token: "#"');
      });
    });

    it('object numberField $gt', () => {
      return companies.find({ query: { jsonObject: { numberField: { $gt: 1.5 } } } }).then(() => {
        throw new Error('Should never get here');
      }).catch(function (error) {
        expect(error).to.be.ok;
        expect(error instanceof errors.GeneralError).to.be.ok;
        expect(error[ERROR].message).to.equal('select `companies`.* from `companies` where CAST(`companies`.`jsonObject`#>>\'{numberField}\' AS text) > 1.5 - SQLITE_ERROR: unrecognized token: "#"');
      });
    });

    it('object nested object', () => {
      return companies.find({ query: { jsonObject: { 'objectField.object': 'string in jsonObject.objectField.object' } } }).then(() => {
        throw new Error('Should never get here');
      }).catch(function (error) {
        expect(error).to.be.ok;
        expect(error instanceof errors.GeneralError).to.be.ok;
        expect(error[ERROR].message).to.equal('select `companies`.* from `companies` where CAST(`companies`.`jsonObject`#>>\'{objectField,object}\' AS text) = \'string in jsonObject.objectField.object\' - SQLITE_ERROR: unrecognized token: "#"');
      });
    });

    it('array', () => {
      return companies.find({ query: { jsonArray: { $ne: null } } }).then(data => {
        expect(data[0].jsonArray[0].objectField.object).to.equal('I\'m string in jsonArray[0].objectField.object');
      });
    });

    it('array nested object', () => {
      return companies.find({ query: { jsonArray: { '[0].objectField.object': 'I\'m string in jsonArray[0].objectField.object' } } }).then(() => {
        throw new Error('Should never get here');
      }).catch(function (error) {
        expect(error).to.be.ok;
        expect(error instanceof errors.GeneralError).to.be.ok;
        expect(error[ERROR].message).to.equal('select `companies`.* from `companies` where CAST(`companies`.`jsonArray`#>>\'{0,objectField,object}\' AS text) = \'I\'\'m string in jsonArray[0].objectField.object\' - SQLITE_ERROR: unrecognized token: "#"');
      });
    });
  });

  describe.skip('JSON column (Postgres)', () => {
    before(async () => {
      await companies
        .create([
          {
            name: 'Google',
            jsonbObject: {
              stringField: 'string',
              numberField: 1.5,
              objectField: {
                object: 'string in jsonObject.objectField.object'
              },
              'first.founder': 'John'
            },
            jsonArray: [
              {
                objectField: {
                  object: 'I\'m string in jsonArray[0].objectField.object'
                }
              }
            ]
          },
          {
            name: 'Apple',
            jsonbObject: {
              stringField: 'string2',
              numberField: 1,
              objectField: {
                object: 'string in jsonObject.objectField.object2'
              },
              'first.founder': 'Dave'
            },
            jsonArray: [
              {
                objectField: {
                  object: 'I\'m string in jsonArray[0].objectField.object2'
                }
              }
            ]
          }
        ]);
    });

    after(async () => {
      await companies.remove(null);
    });

    it('object', () => {
      return companies.find({ query: { jsonbObject: { $ne: null } } }).then(data => {
        expect(data[0].jsonbObject.stringField).to.equal('string');
      });
    });

    it('object stringField', () => {
      return companies.find({ query: { jsonbObject: { stringField: 'string' } } }).then(data => {
        expect(data[0].jsonbObject.stringField).to.equal('string');
      });
    });

    it('object stringField $like', () => {
      return companies.find({ query: { jsonbObject: { stringField: { $like: 'str%' } } } }).then(data => {
        expect(data[0].jsonbObject.stringField).to.equal('string');
      });
    });

    it('object numberField $between', () => {
      return companies.find({ query: { jsonbObject: { numberField: { $between: [1, 2] } } } }).then(data => {
        expect(data[0].jsonbObject.stringField).to.equal('string');
      });
    });

    it('object numberField', () => {
      return companies.find({ query: { jsonbObject: { numberField: 1.5 } } }).then(data => {
        expect(data[0].jsonbObject.numberField).to.equal(1.5);
      });
    });

    it('object numberField $gt', () => {
      return companies.find({ query: { jsonbObject: { numberField: { $gt: 1.4 } } } }).then(data => {
        expect(data[0].jsonArray[0].objectField.object).to.equal('I\'m string in jsonArray[0].objectField.object');
      });
    });

    it('object nested object', () => {
      return companies.find({ query: { jsonbObject: { 'objectField.object': 'string in jsonObject.objectField.object' } } }).then(data => {
        expect(data[0].jsonArray[0].objectField.object).to.equal('I\'m string in jsonArray[0].objectField.object');
      });
    });

    it('array', () => {
      return companies.find({ query: { jsonArray: { $ne: null } } }).then(data => {
        expect(data[0].jsonArray[0].objectField.object).to.equal('I\'m string in jsonArray[0].objectField.object');
      });
    });

    it('array nested object', () => {
      return companies.find({ query: { jsonArray: { '[0].objectField.object': 'I\'m string in jsonArray[0].objectField.object' } } }).then(data => {
        expect(data[0].jsonArray[0].objectField.object).to.equal('I\'m string in jsonArray[0].objectField.object');
      });
    });

    it('dot in property name', () => {
      return companies.find({ query: { jsonbObject: { '(first.founder)': 'John' } } }).then(data => {
        expect(data[0].jsonbObject['first.founder']).to.equal('John');
      });
    });

    it('dot in property name with brackets', () => {
      return companies.find({ query: { jsonbObject: { '[first.founder]': 'John' } } }).then(data => {
        expect(data[0].jsonbObject['first.founder']).to.equal('John');
      });
    });

    it('select & sort with ref', () => {
      return companies.find({
        query: {
          $select: ['name', 'ref(jsonbObject:numberField)', 'ref(jsonbObject:objectField.object) as object'],
          $sort: { 'ref(jsonbObject:numberField)': 1 }
        }
      }).then(data => {
        expect(data.length).to.equal(2);
        expect(data[0].name).to.equal('Apple');
        expect(data[0]['jsonbObject:numberField']).to.equal(1);
        expect(data[0].object).to.equal('string in jsonObject.objectField.object2');
      });
    });
  });

  describe.skip('JSON operators (Postgres)', () => {
    before(async () => {
      await companies
        .create([
          {
            name: 'Google',
            jsonbObject: { a: 1, b: 2, c: { d: [3] }, e: [4] },
            jsonbArray: [1, 2]
          },
          {
            name: 'Apple',
            jsonbObject: { z: 0 },
            jsonbArray: ['a', 'b']
          }
        ]);
    });

    after(async () => {
      await companies.remove(null);
    });

    it('$containsKey', () => {
      return companies.find({ query: { jsonbObject: { $containsKey: 'a' } } }).then(data => {
        expect(data[0].name).to.be.equal('Google');
      });
    });

    it('$containsKey - nested', () => {
      return companies.find({ query: { jsonbObject: { c: { $containsKey: 'd' } } } }).then(data => {
        expect(data[0].name).to.be.equal('Google');
      });
    });

    it('$contains number', () => {
      return companies.find({ query: { jsonbArray: { $contains: 1 } } }).then(data => {
        expect(data[0].name).to.be.equal('Google');
      });
    });

    it('$contains array of numbers', () => {
      return companies.find({ query: { jsonbArray: { $contains: [2, 1] } } }).then(data => {
        expect(data[0].name).to.be.equal('Google');
      });
    });

    it('$contains array of string', () => {
      return companies.find({ query: { jsonbArray: { $contains: ['b', 'a'] } } }).then(data => {
        expect(data[0].name).to.be.equal('Apple');
      });
    });

    it('$contains - nested', () => {
      return companies.find({ query: { jsonbObject: { e: { $contains: 4 } } } }).then(data => {
        expect(data[0].name).to.be.equal('Google');
      });
    });

    it('$contained', () => {
      return companies.find({ query: { jsonbObject: { $contained: JSON.stringify({ a: 1, b: 2, c: { d: [3] }, e: [4], f: 5 }) } } }).then(data => {
        expect(data[0].name).to.be.equal('Google');
      });
    });

    it('$any', () => {
      return companies.find({ query: { jsonbObject: { $any: ['a', 'aa'] } } }).then(data => {
        expect(data[0].name).to.be.equal('Google');
      });
    });

    it('$all', () => {
      return companies.find({ query: { jsonbObject: { $all: ['a', 'b'] } } }).then(data => {
        expect(data[0].name).to.be.equal('Google');
      });
    });

    it('$between', () => {
      return companies.find({ query: { jsonbObject: { b: { $between: [1, 3] } } } }).then(data => {
        expect(data[0].name).to.be.equal('Google');
      });
    });

    it('$between - string', () => {
      return companies.find({ query: { jsonbObject: { b: { $between: '[1, 3]' } } } }).then(data => {
        expect(data[0].name).to.be.equal('Google');
      });
    });

    it('$notBetween', () => {
      return companies.find({ query: { jsonbObject: { b: { $notBetween: [3, 5] } } } }).then(data => {
        expect(data[0].name).to.be.equal('Google');
      });
    });

    it('$notBetween - string', () => {
      return companies.find({ query: { jsonbObject: { b: { $notBetween: '[3, 5]' } } } }).then(data => {
        expect(data[0].name).to.be.equal('Google');
      });
    });
  });

  describe('Transactions', () => {
    let transaction;

    beforeEach(done => {
      db.transaction(trx => {
        transaction = { trx };
        done();
      }).catch(() => {});
    });

    it('works with commit', () => {
      return people.create({ name: 'Commit' }, { transaction }).then(() => {
        return transaction.trx.commit().then(() => {
          return people.find({ query: { name: 'Commit' } }).then((data) => {
            expect(data.length).to.equal(1);
          });
        });
      });
    });

    it('works with rollback', () => {
      return people.create({ name: 'Rollback' }, { transaction }).then(() => {
        return transaction.trx.rollback().then(() => {
          return people.find({ query: { name: 'Rollback' } }).then((data) => {
            expect(data.length).to.equal(0);
          });
        });
      });
    });

    it('works with atomic', () => {
      return people.create({ name: 'Rollback' }, { transaction, atomic: true }).then(() => {
        expect(transaction.trx.isCompleted()).to.equal(false); // Atomic must be ignored and transaction still running
        return transaction.trx.rollback().then(() => {
          return people.find({ query: { name: 'Rollback' } }).then((data) => {
            expect(data.length).to.equal(0);
          });
        });
      });
    });
  });

  describe('Atomic Transactions', () => {
    before(async () => {
      await companies
        .create([
          {
            name: 'Google',
            clients: [
              {
                name: 'Dan Davis'
              },
              {
                name: 'Ken Patrick'
              }
            ]
          },
          {
            name: 'Apple'
          }
        ]);
    });

    after(async () => {
      await clients.remove(null);
      await companies.remove(null);
    });

    it('Rollback on sub insert failure', () => {
      // Dan Davis already exists
      return companies.create({ name: 'Compaq', clients: [{ name: 'Dan Davis' }] }, { atomic: true }).catch((error) => {
        expect(error instanceof errors.Conflict).to.be.ok;
        expect(error[ERROR].message).to.match(/SQLITE_CONSTRAINT: UNIQUE/);
        return companies.find({ query: { name: 'Compaq', $eager: 'clients' } }).then(
          (data) => {
            expect(data.length).to.equal(0);
          });
      });
    });

    it('Rollback on multi insert failure', () => {
      // Google already exists
      return companies.create([{ name: 'Google' }, { name: 'Compaq' }], { atomic: true }).catch((error) => {
        expect(error instanceof errors.Conflict).to.be.ok;
        expect(error[ERROR].message).to.match(/SQLITE_CONSTRAINT: UNIQUE/);
        return companies.find({ query: { name: 'Compaq' } }).then(
          (data) => {
            expect(data.length).to.equal(0);
          });
      });
    });

    it('Rollback on update failure', () => {
      // Dan Davis appears twice, so clients must stay as it is
      return companies.find({ query: { name: 'Google' } }).then(data => {
        return companies.update(data[0].id, {
          name: 'Google',
          clients: [
            {
              name: 'Dan Davis'
            },
            {
              name: 'Dan Davis'
            },
            {
              name: 'Kirk Maelström'
            }
          ]
        }, { atomic: true }).catch((error) => {
          expect(error instanceof errors.Conflict).to.be.ok;
          expect(error[ERROR].message).to.match(/SQLITE_CONSTRAINT: UNIQUE/);
          return companies.find({ query: { name: 'Google', $eager: 'clients' } }).then(
            (data) => {
              expect(data.length).to.equal(1);
              expect(data[0].clients.length).to.equal(2);
              expect(data[0].clients[0].name).to.equal('Dan Davis');
              expect(data[0].clients[1].name).to.equal('Ken Patrick');
            });
        });
      });
    });

    it('Rollback on patch failure', () => {
      // Dan Davis appears twice, so clients must stay as it is
      return companies.find({ query: { name: 'Google' } }).then(data => {
        return companies.patch(data[0].id, {
          clients: [
            {
              name: 'Dan Davis'
            },
            {
              name: 'Dan Davis'
            },
            {
              name: 'Kirk Maelström'
            }
          ]
        }, { atomic: true }).catch((error) => {
          expect(error instanceof UniqueViolationError).to.be.ok;
          expect(error.message).to.match(/SQLITE_CONSTRAINT: UNIQUE/);
          return companies.find({ query: { name: 'Google', $eager: 'clients' } }).then(
            (data) => {
              expect(data.length).to.equal(1);
              expect(data[0].clients.length).to.equal(2);
              expect(data[0].clients[0].name).to.equal('Dan Davis');
              expect(data[0].clients[1].name).to.equal('Ken Patrick');
            });
        });
      });
    });

    it('Commit on patch success', () => {
      // Dan Davis appears twice, so clients must stay as it is
      return companies.find({ query: { name: 'Google' } }).then(data => {
        return companies.patch(data[0].id, {
          clients: [
            {
              name: 'Dan David'
            },
            {
              name: 'Dan Davis'
            },
            {
              name: 'Kirk Maelström'
            }
          ]
        }, { atomic: true }).catch((error) => {
          expect(error instanceof UniqueViolationError).to.be.ok;
          expect(error.message).to.match(/SQLITE_CONSTRAINT: UNIQUE/);
          return companies.find({ query: { name: 'Google', $eager: 'clients' } }).then(
            (data) => {
              expect(data.length).to.equal(1);
              expect(data[0].clients.length).to.equal(3);
              expect(data[0].clients[0].name).to.equal('Dan David');
              expect(data[0].clients[0].name).to.equal('Dan Davis');
              expect(data[0].clients[1].name).to.equal('Kirk Maelström');
            });
        });
      });
    });
  });

  describe('$noSelect', () => {
    beforeEach(async () => {
      await companies
        .create({
          name: 'Google',
          ceo: 1
        });
    });

    afterEach(async () => {
      try {
        await companies.remove(null);
      } catch (err) {}
    });

    it('create with $noSelect', () => {
      return companies.create({
        name: 'Apple',
        ceo: 2
      }, {
        query: {
          $noSelect: true
        }
      }).then(data => {
        expect(data).to.be.ok;
        expect(data.id).to.equal(undefined);
        expect(data.name).to.equal('Apple');
        expect(data.ceo).to.equal(2);
      });
    });

    it('patch with $noSelect', () => {
      return companies.patch(null, {
        name: 'Amazon'
      }, {
        query: {
          ceo: 1,
          $noSelect: true
        }
      }).then(data => {
        expect(data).to.be.ok;
        expect(data.name).to.equal('Amazon');
        delete data.name;
        expect(data).to.be.empty;
      });
    });

    it('remove with $noSelect', () => {
      return companies.remove(null, {
        query: {
          name: 'Google',
          $noSelect: true
        }
      }).then(data => {
        expect(data).to.be.ok;
        expect(data).to.be.empty;
      });
    });
  });

  describe('$null', () => {
    before(async () => {
      await companies
        .create([
          {
            name: 'Google',
            ceo: 1
          },
          {
            name: 'Apple',
            ceo: null
          }
        ]);
    });

    after(async () => {
      await companies.remove(null);
    });

    it('$null - true', () => {
      return companies.find({ query: { ceo: { $null: true } } }).then(data => {
        expect(data.length).to.be.equal(1);
        expect(data[0].name).to.be.equal('Apple');
      });
    });

    it('$null - true string', () => {
      return companies.find({ query: { ceo: { $null: 'true' } } }).then(data => {
        expect(data.length).to.be.equal(1);
        expect(data[0].name).to.be.equal('Apple');
      });
    });

    it('$null - false', () => {
      return companies.find({ query: { ceo: { $null: false } } }).then(data => {
        expect(data.length).to.be.equal(1);
        expect(data[0].name).to.be.equal('Google');
      });
    });

    it('$null - false string', () => {
      return companies.find({ query: { ceo: { $null: 'false' } } }).then(data => {
        expect(data.length).to.be.equal(1);
        expect(data[0].name).to.be.equal('Google');
      });
    });
  });

  describe('$modify', () => {
    const ids = {};

    beforeEach(async () => {
      ids.companies = await companies
        .create([
          {
            name: 'Google',
            ceo: 1,
            size: 'medium'
          },
          {
            name: 'Apple',
            ceo: null,
            size: 'large'
          }
        ]);

      ids.employees = await employees
        .create([
          {
            name: 'John',
            companyId: ids.companies[0].id
          },
          {
            name: 'Dave',
            companyId: ids.companies[1].id
          }
        ]);
    });

    afterEach(async () => {
      companies.options.paginate = {};

      for (const employee of ids.employees) { await employees.remove(employee.id); }

      await companies.remove(null);
    });

    it('allow $modify query', () => {
      return companies.find({ query: { $modify: ['google'] } }).then(data => {
        expect(data.length).to.be.equal(1);
        expect(data[0].name).to.be.equal('Google');
      });
    });

    it('allow $modify query with paginate', () => {
      companies.options.paginate = {
        default: 1,
        max: 2
      };

      return companies.find({ query: { $modify: ['google'] } }).then(data => {
        expect(data.total).to.be.equal(1);
        expect(data.data.length).to.be.equal(1);
        expect(data.data[0].name).to.be.equal('Google');
      });
    });

    it('allow $modify query with paginate and no results', () => {
      companies.options.paginate = {
        default: 1,
        max: 2
      };

      return companies.find({ query: { $modify: ['google'], size: 'small' } }).then(data => {
        expect(data.total).to.be.equal(0);
        expect(data.data.length).to.be.equal(0);
      });
    });

    it('allow $modify query with paginate and eager in modifier', () => {
      companies.options.paginate = {
        default: 1,
        max: 2
      };

      return companies.find({ query: { $modify: ['withRelation'], $sort: { 'companies.name': -1 } } }).then(data => {
        expect(data.total).to.be.equal(2);
        expect(data.data.length).to.be.equal(1);
        expect(data.data[0].name).to.be.equal('Google');
        expect(data.data[0].employees.length).to.be.equal(1);
        expect(data.data[0].employees[0].name).to.be.equal('John');
      });
    });

    it('params.modifierFiltersResults=false does not apply count from modify query', () => {
      companies.options.paginate = {
        default: 2,
        max: 2
      };

      return companies.find({
        query: { $modify: ['withRelationAndGroupBy'] }, modifierFiltersResults: false
      }).then(data => {
        expect(data.total).to.be.equal(2);
        expect(data.data.length).to.be.equal(2);
        expect(data.data[0].name).to.be.equal('Google');
      });
    });

    it('params.modifierFiltersResults=true applies count from modify query', () => {
      companies.options.paginate = {
        default: 2,
        max: 2
      };

      return companies.find({
        query: { $modify: ['withRelationAndGroupBy'] }, modifierFiltersResults: true
      }).then(data => {
        expect(data.total).to.be.equal(2); // count result from GROUP BY
        expect(data.data.length).to.be.equal(2);
        expect(data.data[0].name).to.be.equal('Google');
      });
    });

    it('params.modifierFiltersResults=undefined applies count from modify query', () => {
      companies.options.paginate = {
        default: 2,
        max: 2
      };

      return companies.find({ query: { $modify: ['withRelationAndGroupBy'] } }).then(data => {
        expect(data.total).to.be.equal(2); // count result from GROUP BY
        expect(data.data.length).to.be.equal(2);
        expect(data.data[0].name).to.be.equal('Google');
      });
    });

    it('allow $modify query with paginate, groupBy and joinRelation', () => {
      companies.options.paginate = {
        default: 1,
        max: 2
      };

      return companies.find({ query: { $modify: ['google'], $joinRelation: 'employees' } }).then(data => {
        expect(data.total).to.be.equal(1);
        expect(data.data.length).to.be.equal(1);
        expect(data.data[0].name).to.be.equal('Google');
      });
    });

    it.skip('allow $modify query with paginate, groupBy and eager (not with SQLite)', () => {
      companies.options.paginate = {
        default: 1,
        max: 2
      };

      return companies.find({ query: { $modify: ['googleWithEager'], $eager: 'employees' } }).then(data => {
        expect(data.total).to.be.equal(1);
        expect(data.data.length).to.be.equal(1);
        expect(data.data[0].name).to.be.equal('Google');
      });
    });

    it('allow $modify query as string', () => {
      return companies.find({ query: { $modify: 'google' } }).then(data => {
        expect(data.length).to.be.equal(1);
        expect(data[0].name).to.be.equal('Google');
      });
    });

    it('allow $modify query as string with multiple modifiers', () => {
      return companies.find({ query: { $modify: 'apple,large' } }).then(data => {
        expect(data.length).to.be.equal(1);
        expect(data[0].name).to.be.equal('Apple');
      });
    });

    it('allow $modify query with serialized array', () => {
      return companies.find({ query: { $modify: JSON.stringify(['google']) } }).then(data => {
        expect(data.length).to.be.equal(1);
        expect(data[0].name).to.be.equal('Google');
      });
    });

    it('allow $modify query with serialized object', () => {
      return companies.find({
        query: { $modify: JSON.stringify({ apple: true }) }
      }).then(data => {
        expect(data.length).to.be.equal(1);
        expect(data[0].name).to.be.equal('Apple');
      });
    });

    it('allow $modify query with args', () => {
      return companies.find({ query: { $modify: ['large', false] } }).then(data => {
        expect(data.length).to.be.equal(1);
        expect(data[0].name).to.be.equal('Apple');
      });
    });

    it('allow $modify query with multiple modifiers', () => {
      return companies.find({ query: { $modify: [['apple', 'large']] } }).then(data => {
        expect(data.length).to.be.equal(1);
        expect(data[0].name).to.be.equal('Apple');
      });
    });

    it('allow $modify query with multiple modifiers and args', () => {
      return companies.find({ query: { $modify: [['apple', 'large'], true] } }).then(data => {
        expect(data.length).to.be.equal(0);
      });
    });

    it('allow $modify query with multiple modifiers and different args for each', () => {
      return companies.find({
        query: {
          $modify: {
            apple: [false],
            large: [false],
            withRelation: true
          }
        }
      }).then(data => {
        expect(data.length).to.be.equal(1);
        expect(data[0].name).to.be.equal('Apple');
        expect(data[0].employees.length).to.be.equal(1);
        expect(data[0].employees[0].name).to.be.equal('Dave');
      });
    });
  });

  describe('Create with ID', () => {
    beforeEach(async () => {
      await companies.create({ name: 'Apple' });
    });

    afterEach(async () => {
      await companies.remove(null);
    });

    it('create with id when id is overridden in model', () => {
      return companies.create({ id: 1, name: 'Google' }).then(data => {
        expect(data).to.be.ok;
        expect(data.name).to.be.equal('Google');
      });
    });
  });

  describe('Patch with same field in data & query', () => {
    let company;

    beforeEach(async () => {
      company = await companies.create({ name: 'Apple' });
    });

    afterEach(async () => {
      await companies.remove(null);
    });

    it('Patch with id', () => {
      return companies.patch(company.id, {
        name: 'Google'
      }, {
        query: {
          name: 'Apple'
        }
      }).then(data => {
        expect(data).to.be.ok;
        expect(data.name).to.be.equal('Google');
      });
    });

    it('Patch without id', () => {
      return companies.patch(null, {
        name: 'Google'
      }, {
        query: {
          name: 'Apple'
        }
      }).then(data => {
        expect(data.length).to.be.equal(1);
        expect(data[0].name).to.be.equal('Google');
      });
    });
  });

  describe('$allowRefs', () => {
    const ids = {};

    beforeEach(async () => {
      ids.ceo = await people
        .create({
          name: 'Snoop',
          age: 20
        });

      ids.companies = await companies
        .create([
          {
            name: 'small',
            ceo: ids.ceo.id,
            size: 'small'
          },
          {
            name: 'Apple',
            ceo: ids.ceo.id,
            size: 'large'
          }
        ]);

      const [small, apple] = ids.companies;

      ids.employees = await employees
        .create([
          {
            name: 'John',
            companyId: small.id
          },
          {
            name: 'Apple',
            companyId: apple.id
          }
        ]);
    });

    afterEach(async () => {
      await people.remove(ids.ceo.id);

      for (const employee of ids.employees) { await employees.remove(employee.id); }

      for (const company of ids.companies) { await companies.remove(company.id); }
    });

    it('allow allowRefs queries', () => {
      return companies.find({ query: { name: 'ref(size)', $allowRefs: true } }).then(data => {
        expect(data.length).to.equal(1);
        expect(data[0].name).to.equal('small');
      });
    });

    it('query with ref when not allowed', () => {
      return companies.find({ query: { name: 'ref(size)' } }).then(data => {
        expect(data.length).to.equal(0);
      });
    });

    it('patch with ref', () => {
      return companies.patch(null, { ceo: null }, { query: { name: 'ref(size)', $allowRefs: true } }).then(data => {
        expect(data.length).to.equal(1);
        expect(data[0].ceo).to.be.null;
      });
    });

    it('remove with ref', () => {
      return companies.remove(null, { query: { name: 'ref(size)', $allowRefs: true } }).then(data => {
        expect(data.length).to.equal(1);
        expect(data[0].name).to.equal('small');
      });
    });

    it('joinEager queries with ref', () => {
      return employees.find({ query: { $joinEager: 'company', 'company.name': 'ref(employees.name)', $allowRefs: true } }).then(data => {
        expect(data.length).to.equal(1);
        expect(data[0].name).to.equal('Apple');
        expect(data[0].company).to.be.ok;
        expect(data[0].company.name).to.equal('Apple');
      });
    });

    it('joinRelation queries with ref', () => {
      return employees.find({ query: { $eager: 'company', $joinRelation: 'company', 'company.name': 'ref(employees.name)', $allowRefs: true } }).then(data => {
        expect(data.length).to.equal(1);
        expect(data[0].name).to.equal('Apple');
        expect(data[0].company).to.be.ok;
        expect(data[0].company.name).to.equal('Apple');
      });
    });
  });
});
