/* eslint-env mocha */
/* eslint-disable no-unused-expressions */
import { expect } from 'chai'
import assert from 'assert'
import feathers from 'feathers'
import knex from 'knex'
import { base, example } from 'feathers-service-tests'
import { errors } from 'feathers-errors'
import service from '../src'
import server from '../example/app'
import People from './people'
import PeopleCustomid from './people-customid'
import PeopleRoom from './people-rooms'
import PeopleRoomsCustomIdSeparator from './people-rooms-custom-id-separator'
import Company from './company'
import { Model } from 'objection'
import Employee from './employee'

const db = knex({
  client: 'sqlite3',
  debug: false,
  connection: {
    filename: './db.sqlite'
  }
})

// Bind Objection.js
Model.knex(db)

const app = feathers()
  .use(
    '/people',
    service({
      model: People,
      id: 'id',
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
      events: ['testing']
    })
  )
  .use(
    '/people-rooms-custom-id-separator',
    service({
      model: PeopleRoomsCustomIdSeparator,
      id: ['peopleId', 'roomId'],
      idSeparator: '.',
      events: ['testing']
    })
  )
  .use(
    '/companies',
    service({
      model: Company,
      id: 'id',
      events: ['testing'],
      allowedEager: 'ceos',
      namedEagerFilters: {
        notSnoop (builder) {
          return builder.whereNot('name', 'Snoop')
        }
      },
      eagerFilters: [
        {
          expression: 'ceos',
          filter: function youngCEOs (builder) {
            return builder.where('age', '<', '25')
          }
        }
      ]
    })
  )
  .use(
    '/employees',
    service({
      model: Employee,
      allowedEager: 'company'
    })
  )

let people = app.service('people')
let peopleRooms = app.service('people-rooms')
let peopleRoomsCustomIdSeparator = app.service('people-rooms-custom-id-separator')
let companies = app.service('companies')
let employees = app.service('employees')

function clean (done) {
  db.schema
    .dropTableIfExists('people')
    .then(() => {
      return db.schema.createTable('people', table => {
        table.increments('id')
        table.string('name')
        table.integer('age')
        table.integer('time')
        table.boolean('created')
      })
    })
    .then(() => {
      return db.schema.dropTableIfExists('people-customid').then(() => {
        return db.schema.createTable('people-customid', table => {
          table.increments('customid')
          table.string('name')
          table.integer('age')
          table.integer('time')
          table.boolean('created')
        })
      })
    })
    .then(() => {
      return db.schema.dropTableIfExists('people-rooms').then(() => {
        return db.schema.createTable('people-rooms', table => {
          table.integer('peopleId')
          table.integer('roomId')
          table.boolean('admin')
          table.primary(['peopleId', 'roomId'])
        })
      })
    })
    .then(() => {
      return db.schema.dropTableIfExists('people-rooms-custom-id-separator').then(() => {
        return db.schema.createTable('people-rooms-custom-id-separator', table => {
          table.integer('peopleId')
          table.integer('roomId')
          table.boolean('admin')
          table.primary(['peopleId', 'roomId'])
        })
      })
    })
    .then(() => {
      return db.schema.dropTableIfExists('companies').then(() => {
        return db.schema.createTable('companies', table => {
          table.increments('id')
          table.string('name')
          table.integer('ceo')
        })
      })
    })
    .then(() => {
      return db.schema.dropTableIfExists('employees').then(() => {
        return db.schema
          .createTable('employees', table => {
            table.increments('id')
            table.integer('companyId').references('companies.id')
            table.string('name')
          })
          .then(() => done())
      })
    })
}

describe('Feathers Objection Service', () => {
  before(clean)
  after(clean)

  describe('Initialization', () => {
    describe('when missing options', () => {
      it('throws an error', () => {
        expect(service.bind(null)).to.throw(
          'Objection options have to be provided'
        )
      })
    })

    describe('when missing a Model', () => {
      it('throws an error', () => {
        expect(service.bind(null, {})).to.throw(
          /You must provide an Objection Model/
        )
      })
    })

    describe('when missing the id option', () => {
      it('sets the default to be id', () => {
        expect(people.id).to.equal('id')
      })
    })

    describe('when missing the paginate option', () => {
      it('sets the default to be {}', () => {
        expect(people.paginate).to.deep.equal({})
      })
    })

    describe('when missing allowedEager', () => {
      it('sets the default to be empty string', () => {
        expect(people.allowedEager).to.equal('[]')
      })
    })

    describe('when missing namedEagerFilters', () => {
      it('sets the default to be undefined', () => {
        expect(people.namedEagerFilters).to.equal(undefined)
      })
    })

    describe('when missing eagerFilters', () => {
      it('sets the default to be undefined', () => {
        expect(people.eagerFilters).to.equal(undefined)
      })
    })
  })

  describe('Common functionality', () => {
    it('is CommonJS compatible', () =>
      assert.equal(typeof require('../lib'), 'function'))

    base(app, errors, 'people')
    base(app, errors, 'people-customid', 'customid')
  })

  describe('Composite PK queries', () => {
    beforeEach(done => {
      peopleRooms
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
        ])
        .then(data => {
          return peopleRoomsCustomIdSeparator
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
            ])
            .then(() => done())
        }, done)
    })

    afterEach(done => {
      peopleRooms
        .remove(null)
        .then(data => {
          return peopleRoomsCustomIdSeparator
            .remove(null)
            .then(() => done())
        }, done)
    })

    it('allows get queries', () => {
      return peopleRooms.get([2, 2]).then(data => {
        expect(data.peopleId).to.equal(2)
        expect(data.roomId).to.equal(2)
        expect(data.admin).to.equal(1)
      })
    })

    it('allows get queries by object', () => {
      return peopleRooms.get({ peopleId: 2, roomId: 2 }).then(data => {
        expect(data.peopleId).to.equal(2)
      })
    })

    it('allows get queries by separator', () => {
      return peopleRooms.get('2,2').then(data => {
        expect(data.peopleId).to.equal(2)
      })
    })

    it('allows get queries by custom separator', () => {
      return peopleRoomsCustomIdSeparator.get('2.2').then(data => {
        expect(data.peopleId).to.equal(2)
      })
    })

    it('allows find queries', () => {
      return peopleRooms.find({ query: { roomId: 2 } }).then(data => {
        expect(data.length).to.equal(2)
        expect(data[0].peopleId).to.equal(1)
        expect(data[1].peopleId).to.equal(2)
      })
    })

    it('allows patch queries', () => {
      return peopleRooms.patch([2, 2], { admin: false, peopleId: 1 }).then(data => {
        expect(data.peopleId).to.equal(2)
        expect(data.admin).to.equal(0)
      })
    })

    it('allows update queries', () => {
      return peopleRooms.update([2, 2], { admin: false, peopleId: 1 }).then(data => {
        expect(data.peopleId).to.equal(2)
        expect(data.admin).to.equal(false)
      })
    })

    it('allows remove queries', () => {
      return peopleRooms.remove([2, 2]).then(data => {
        return peopleRooms.find().then(data => {
          expect(data.length).to.equal(2)
        })
      })
    })
  })

  describe('Eager queries', () => {
    beforeEach(done => {
      people
        .create({
          name: 'Snoop',
          age: 20
        })
        .then(data => {
          return companies
            .create([
              {
                name: 'Google',
                ceo: data.id
              },
              {
                name: 'Apple',
                ceo: data.id
              }
            ])
            .then(() => done())
        }, done)
    })

    it('allows eager queries', () => {
      return companies.find({ query: { $eager: 'ceos' } }).then(data => {
        expect(data[0].ceos).to.be.ok
      })
    })

    it('allows eager queries with pick', () => {
      return companies.find({ query: { $eager: 'ceos', $pick: ['ceos'] } }).then(data => {
        expect(data[0].ceos).to.be.ok
        expect(data[0].ceo).to.be.undefined
      })
    })

    it('allows eager queries with named filters', () => {
      return companies
        .find({ query: { $eager: 'ceos(notSnoop)' } })
        .then(data => {
          expect(data[0].ceos).to.be.null
        })
    })

    it('disallow eager queries', () => {
      return companies
        .find({ query: { $eager: 'employees' } })
        .then(data => {
          throw new Error('Should not reach here')
        })
        .catch(error => {
          expect(error.code).to.equal(400)
          expect(error.data).to.deep.equal({})
        })
    })
  })

  describe('Join Eager queries', () => {
    before(done => {
      companies
        .create([
          {
            name: 'Google'
          },
          {
            name: 'Apple'
          }
        ])
        .then(data => {
          const [google, apple] = data
          return employees
            .create([
              {
                name: 'Luke',
                companyId: google.id
              },
              {
                name: 'Yoda',
                companyId: apple.id
              }
            ])
            .then(() => done())
        }, done)
    })

    it('allows joinEager queries', () => {
      return employees.find({ query: { $joinEager: 'company' } }).then(data => {
        expect(data[0].company).to.be.ok
        expect(data[1].company).to.be.ok
      })
    })

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
          expect(data.length).to.equal(1)
          expect(data[0].company.name).to.equal('Google')
        })
    })

    it('allows joinRelation queries', () => {
      return employees.find({ query: { $joinRelation: 'company', $eager: 'company' } }).then(data => {
        expect(data[0].company).to.be.ok
        expect(data[1].company).to.be.ok
      })
    })

    it('allows filtering by relation field with joinRelation queries', () => {
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
          expect(data.length).to.equal(1)
          expect(data[0].company.name).to.equal('Google')
        })
    })
  })

  describe('$like method', () => {
    beforeEach(done => {
      people.create(
        {
          name: 'Charlie Brown',
          age: 10
        },
        done
      )
    })

    it('$like in query', () => {
      return people.find({ query: { name: { $like: '%lie%' } } }).then(data => {
        expect(data[0].name).to.be.equal('Charlie Brown')
      })
    })
  })

  describe('$and method', () => {
    beforeEach(done => {
      people.create([
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
      ],
      done
      )
    })

    it('$and in query', () => {
      return people.find({ query: { $and: [ { $or: [ { name: 'Dave' }, { name: 'Dada' } ] }, { age: { $lt: 23 } } ] } }).then(data => {
        expect(data[0].name).to.be.equal('Dada')
      })
    })
  })

  describe('$or method', () => {
    beforeEach(done => {
      people.create([
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
      ],
      done
      )
    })

    it('$or in query', () => {
      return people.find({ query: { $or: [ { name: 'John' }, { name: 'Dada' } ] } }).then(data => {
        expect(data[0].name).to.be.equal('Dada')
      })
    })
  })

  describe('Transactions', () => {
    let transaction

    beforeEach(done => {
      db.transaction(trx => {
        transaction = { trx }
        done()
      }).catch(() => {})
    })

    it('works with commit', () => {
      return people.create({ name: 'Commit' }, { transaction }).then(() => {
        return transaction.trx.commit().then(() => {
          return people.find({ query: { name: 'Commit' } }).then((data) => {
            expect(data.length).to.equal(1)
          })
        })
      })
    })

    it('works with rollback', () => {
      return people.create({ name: 'Rollback' }, { transaction }).then(() => {
        return transaction.trx.rollback().then(() => {
          return people.find({ query: { name: 'Rollback' } }).then((data) => {
            expect(data.length).to.equal(0)
          })
        })
      })
    })
  })
})

describe('Objection service example test', () => {
  after(done => server.close(() => done()))

  example()
})
