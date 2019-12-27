/* eslint-env mocha */
/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import assert from 'assert';
import feathers from '@feathersjs/feathers';
import knex from 'knex';
import adapterTests from '@feathersjs/adapter-tests';
import errors from '@feathersjs/errors';
import service from '../src';
import errorHandler from '../src/error-handler';
import People from './people';
import PeopleCustomid from './people-customid';
import PeopleRoom from './people-rooms';
import PeopleRoomsCustomIdSeparator from './people-rooms-custom-id-separator';
import Company from './company';
import Employee from './employee';
import Client from './client';
import { Model } from 'objection';

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
  '.find',
  '.remove',
  '.remove + $select',
  '.remove + id + query',
  '.remove + multi',
  '.update',
  '.update + $select',
  '.update + id + query',
  '.update + NotFound',
  '.patch',
  '.patch + $select',
  '.patch + id + query',
  '.patch multiple',
  '.patch multi query',
  '.patch + NotFound',
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
      whitelist: ['$and', '$like', '$between', '$notBetween'],
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
      whitelist: ['$eager', '$modifyEager', '$mergeEager', '$pick', '$between', '$notBetween', '$containsKey', '$contains', '$contained', '$any', '$all', '$noSelect', '$like'],
      allowedEager: '[ceos, clients]',
      namedEagerFilters: {
        notSnoop (builder) {
          return builder.whereNot('name', 'Snoop');
        }
      },
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
      whitelist: ['$eager', '$joinRelation', '$joinEager', '$like'],
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
      allowedEager: 'company',
      events: ['testing']
    })
  );

const people = app.service('people');
const peopleRooms = app.service('people-rooms');
const peopleRoomsCustomIdSeparator = app.service('people-rooms-custom-id-separator');
const companies = app.service('companies');
const employees = app.service('employees');

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
              table.json('jsonObject');
              table.json('jsonArray');
              table.jsonb('jsonbObject');
              table.jsonb('jsonbArray');
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
            table.integer('companyId').references('companies.id');
            table.string('name');
          });
      });
    })
    .then(() => {
      return db.schema.dropTableIfExists('clients').then(() => {
        return db.schema
          .createTable('clients', table => {
            table.increments('id');
            table.integer('companyId').references('companies.id');
            table.string('name');
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

    describe('when missing namedEagerFilters', () => {
      it('sets the default to be undefined', () => {
        expect(people.namedEagerFilters).to.equal(undefined);
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
      expect(errorHandler.bind(null, error)).to.not.throw(errors.GeneralError);
    });

    describe('SQLite', () => {
      it('Unknown error code', () => {
        const error = new Error();
        error.code = 'SQLITE_ERROR';
        error.errno = 999;
        expect(errorHandler.bind(null, error)).to.throw(errors.GeneralError);
      });

      it('BadRequest 1', () => {
        const error = new Error();
        error.code = 'SQLITE_ERROR';
        error.errno = 1;
        expect(errorHandler.bind(null, error)).to.throw(errors.BadRequest);
      });

      it('BadRequest 8', () => {
        const error = new Error();
        error.code = 'SQLITE_ERROR';
        error.errno = 8;
        expect(errorHandler.bind(null, error)).to.throw(errors.BadRequest);
      });

      it('BadRequest 18', () => {
        const error = new Error();
        error.code = 'SQLITE_ERROR';
        error.errno = 18;
        expect(errorHandler.bind(null, error)).to.throw(errors.BadRequest);
      });

      it('BadRequest 19', () => {
        const error = new Error();
        error.code = 'SQLITE_ERROR';
        error.errno = 19;
        expect(errorHandler.bind(null, error)).to.throw(errors.BadRequest);
      });

      it('BadRequest 20', () => {
        const error = new Error();
        error.code = 'SQLITE_ERROR';
        error.errno = 20;
        expect(errorHandler.bind(null, error)).to.throw(errors.BadRequest);
      });

      it('Unavailable 2', () => {
        const error = new Error();
        error.code = 'SQLITE_ERROR';
        error.errno = 2;
        expect(errorHandler.bind(null, error)).to.throw(errors.Unavailable);
      });

      it('Forbidden 3', () => {
        const error = new Error();
        error.code = 'SQLITE_ERROR';
        error.errno = 3;
        expect(errorHandler.bind(null, error)).to.throw(errors.Forbidden);
      });

      it('Forbidden 23', () => {
        const error = new Error();
        error.code = 'SQLITE_ERROR';
        error.errno = 23;
        expect(errorHandler.bind(null, error)).to.throw(errors.Forbidden);
      });

      it('NotFound 12', () => {
        const error = new Error();
        error.code = 'SQLITE_ERROR';
        error.errno = 12;
        expect(errorHandler.bind(null, error)).to.throw(errors.NotFound);
      });
    });

    describe('Objection', () => {
      it('Unknown error code', () => {
        const error = new Error();
        error.statusCode = 999;
        expect(errorHandler.bind(null, error)).to.throw(errors.GeneralError);
      });

      it('BadRequest 400', () => {
        const error = new Error();
        error.statusCode = 400;
        expect(errorHandler.bind(null, error)).to.throw(errors.BadRequest);
      });

      it('NotAuthenticated 401', () => {
        const error = new Error();
        error.statusCode = 401;
        expect(errorHandler.bind(null, error)).to.throw(errors.NotAuthenticated);
      });

      it('PaymentError 402', () => {
        const error = new Error();
        error.statusCode = 402;
        expect(errorHandler.bind(null, error)).to.throw(errors.PaymentError);
      });

      it('Forbidden 403', () => {
        const error = new Error();
        error.statusCode = 403;
        expect(errorHandler.bind(null, error)).to.throw(errors.Forbidden);
      });

      it('NotFound 404', () => {
        const error = new Error();
        error.statusCode = 404;
        expect(errorHandler.bind(null, error)).to.throw(errors.NotFound);
      });

      it('MethodNotAllowed 405', () => {
        const error = new Error();
        error.statusCode = 405;
        expect(errorHandler.bind(null, error)).to.throw(errors.MethodNotAllowed);
      });

      it('NotAcceptable 406', () => {
        const error = new Error();
        error.statusCode = 406;
        expect(errorHandler.bind(null, error)).to.throw(errors.NotAcceptable);
      });

      it('Timeout 408', () => {
        const error = new Error();
        error.statusCode = 408;
        expect(errorHandler.bind(null, error)).to.throw(errors.Timeout);
      });

      it('Conflict 409', () => {
        const error = new Error();
        error.statusCode = 409;
        expect(errorHandler.bind(null, error)).to.throw(errors.Conflict);
      });

      it('Unprocessable 422', () => {
        const error = new Error();
        error.statusCode = 422;
        expect(errorHandler.bind(null, error)).to.throw(errors.Unprocessable);
      });

      it('GeneralError 500', () => {
        const error = new Error();
        error.statusCode = 500;
        expect(errorHandler.bind(null, error)).to.throw(errors.GeneralError);
      });

      it('NotImplemented 501', () => {
        const error = new Error();
        error.statusCode = 501;
        expect(errorHandler.bind(null, error)).to.throw(errors.NotImplemented);
      });

      it('Unavailable 503', () => {
        const error = new Error();
        error.statusCode = 503;
        expect(errorHandler.bind(null, error)).to.throw(errors.Unavailable);
      });
    });

    describe('Postgres', () => {
      it('Unknown error code', () => {
        const error = new Error();
        error.code = '999';
        expect(errorHandler.bind(null, error)).to.throw(errors.GeneralError);
      });

      it('Forbidden 28', () => {
        const error = new Error();
        error.code = '28';
        expect(errorHandler.bind(null, error)).to.throw(errors.Forbidden);
      });

      it('Forbidden 42', () => {
        const error = new Error();
        error.code = '42';
        expect(errorHandler.bind(null, error)).to.throw(errors.Forbidden);
      });

      it('BadRequest 20', () => {
        const error = new Error();
        error.code = '20';
        expect(errorHandler.bind(null, error)).to.throw(errors.BadRequest);
      });

      it('BadRequest 21', () => {
        const error = new Error();
        error.code = '21';
        expect(errorHandler.bind(null, error)).to.throw(errors.BadRequest);
      });

      it('BadRequest 22', () => {
        const error = new Error();
        error.code = '22';
        expect(errorHandler.bind(null, error)).to.throw(errors.BadRequest);
      });

      it('BadRequest 23', () => {
        const error = new Error();
        error.code = '23';
        expect(errorHandler.bind(null, error)).to.throw(errors.BadRequest);
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

      for (const company of ids.companies) { await companies.remove(company.id); }

      for (const employee of ids.employees) { await employees.remove(employee.id); }
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

    it('allows modifyEager queries', () => {
      return companies.find({ query: { $eager: 'employees', $modifyEager: { employees: { name: 'John' } } }, mergeAllowEager: 'employees' }).then(data => {
        expect(data[0].employees.length).to.equal(2);
        expect(data[1].employees.length).to.equal(0);
      });
    });

    it('allows eager queries with pick', () => {
      return companies.find({ query: { $eager: 'ceos', $pick: ['ceos'] } }).then(data => {
        expect(data[0].ceos).to.be.ok;
        expect(data[0].ceo).to.be.undefined;
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
      return companies
        .find({ query: { $eager: 'employees' } })
        .then(data => {
          throw new Error('Should not reach here');
        })
        .catch(error => {
          expect(error.code).to.equal(400);
          expect(error.data).to.deep.equal({});
        });
    });
  });

  describe('Join Eager/Relation queries', () => {
    before(async () => {
      const data = await companies
        .create([
          {
            name: 'Google'
          },
          {
            name: 'Apple'
          }
        ]);

      const [google, apple] = data;
      await employees
        .create([
          {
            name: 'Luke',
            companyId: google.id
          },
          {
            name: 'Yoda',
            companyId: apple.id
          }
        ]);
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
              $like: 'google'
            }
          }
        })
        .then(data => {
          expect(data.length).to.equal(1);
          expect(data[0].company.name).to.equal('Google');
        });
    });

    it('allows joinRelation queries', () => {
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
            $eager: 'company',
            $joinRelation: 'company',
            'company.name': {
              $like: 'google'
            }
          }
        })
        .then(data => {
          expect(data.length).to.equal(1);
          expect(data[0].company.name).to.equal('Google');
        });
    });
  });

  describe('Graph Insert Queries', () => {
    before(async () => {
      await companies.remove(null);
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

    beforeEach(async () => {
      await companies.remove(null);

      ceo = await people
        .create({
          name: 'Snoop',
          age: 20
        });

      [google] = await companies
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
      await people.remove(ceo.id);
    });

    it('allows upsertGraph queries on update', () => {
      const newClients = (google.clients) ? google.clients.concat([{
        name: 'Ken Patrick'
      }]) : [];

      return companies
        .update(google.id, {
          id: google.id,
          name: 'Alphabet',
          clients: newClients
        }, { query: { $eager: 'clients' } }).then(() => {
          return companies.find({ query: { $eager: 'clients' } }).then(data => {
            expect(data[0].name).equal('Alphabet');
            expect(data[0].clients).to.be.an('array');
            expect(data[0].clients).to.have.lengthOf(2);
          });
        });
    });

    it('allows upsertGraph queries on patch', () => {
      const newClients = (google.clients) ? google.clients.concat([{
        name: 'Ken Patrick'
      }]) : [];

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
        expect(error instanceof errors.BadRequest).to.be.ok;
        expect(error.message).to.equal('select `companies`.* from `companies` where CAST(`companies`.`jsonObject`#>>\'{numberField}\' AS text) = 1.5 - SQLITE_ERROR: unrecognized token: "#"');
      });
    });

    it('object numberField $gt', () => {
      return companies.find({ query: { jsonObject: { numberField: { $gt: 1.5 } } } }).then(() => {
        throw new Error('Should never get here');
      }).catch(function (error) {
        expect(error).to.be.ok;
        expect(error instanceof errors.BadRequest).to.be.ok;
        expect(error.message).to.equal('select `companies`.* from `companies` where CAST(`companies`.`jsonObject`#>>\'{numberField}\' AS text) > 1.5 - SQLITE_ERROR: unrecognized token: "#"');
      });
    });

    it('object nested object', () => {
      return companies.find({ query: { jsonObject: { 'objectField.object': 'string in jsonObject.objectField.object' } } }).then(() => {
        throw new Error('Should never get here');
      }).catch(function (error) {
        expect(error).to.be.ok;
        expect(error instanceof errors.BadRequest).to.be.ok;
        expect(error.message).to.equal('select `companies`.* from `companies` where CAST(`companies`.`jsonObject`#>>\'{objectField,object}\' AS text) = \'string in jsonObject.objectField.object\' - SQLITE_ERROR: unrecognized token: "#"');
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
        expect(error instanceof errors.BadRequest).to.be.ok;
        expect(error.message).to.equal('select `companies`.* from `companies` where CAST(`companies`.`jsonArray`#>>\'{0,objectField,object}\' AS text) = \'I\'\'m string in jsonArray[0].objectField.object\' - SQLITE_ERROR: unrecognized token: "#"');
      });
    });
  });

  describe.skip('JSON column (Postgres)', () => {
    before(async () => {
      await companies
        .create([
          {
            name: 'Google',
            jsonObject: {
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
          }
        ]);
    });

    after(async () => {
      await companies.remove(null);
    });

    it('object', () => {
      return companies.find({ query: { jsonObject: { $ne: null } } }).then(data => {
        expect(data[0].jsonObject.stringField).to.equal('string');
      });
    });

    it('object stringField', () => {
      return companies.find({ query: { jsonObject: { stringField: 'string' } } }).then(data => {
        expect(data[0].jsonObject.stringField).to.equal('string');
      });
    });

    it('object stringField $like', () => {
      return companies.find({ query: { jsonObject: { stringField: { $like: 'str%' } } } }).then(data => {
        expect(data[0].jsonObject.stringField).to.equal('string');
      });
    });

    it('object numberField $between', () => {
      return companies.find({ query: { jsonObject: { numberField: { $between: [1, 2] } } } }).then(data => {
        expect(data[0].jsonObject.stringField).to.equal('string');
      });
    });

    it('object numberField', () => {
      return companies.find({ query: { jsonObject: { numberField: 1.5 } } }).then(data => {
        expect(data[0].jsonObject.numberField).to.equal(1.5);
      });
    });

    it('object numberField $gt', () => {
      return companies.find({ query: { jsonObject: { numberField: { $gt: 1.4 } } } }).then(data => {
        expect(data[0].jsonArray[0].objectField.object).to.equal('I\'m string in jsonArray[0].objectField.object');
      });
    });

    it('object nested object', () => {
      return companies.find({ query: { jsonObject: { 'objectField.object': 'string in jsonObject.objectField.object' } } }).then(data => {
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
      return companies.find({ query: { jsonObject: { '(first.founder)': 'John' } } }).then(data => {
        expect(data[0].jsonObject['first.founder']).to.equal('John');
      });
    });

    it('dot in property name with brackets', () => {
      return companies.find({ query: { jsonObject: { '[first.founder]': 'John' } } }).then(data => {
        expect(data[0].jsonObject['first.founder']).to.equal('John');
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
  });

  describe('$noSelect', () => {
    beforeEach(async () => {
      await companies
        .create([
          {
            name: 'Google',
            ceo: 1
          }
        ]);
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
});
