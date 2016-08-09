/* eslint-env mocha */
import { expect } from 'chai'
import assert from 'assert'
import feathers from 'feathers'
import knex from 'knex'
import { base, orm, example } from 'feathers-service-tests'
import { errors } from 'feathers-errors'
import service from '../src'
import server from '../example/app'
import People from './people'
import Company from './company'
import { Model } from 'objection'

const db = knex({
  client: 'sqlite3',
  connection: {
    filename: './db.sqlite'
  }
})

// Bind Objection.js
Model.knex(db)

const app = feathers()
  .use('/people', service({
    model: People,
    id: 'id'
  }))
  .use('/companies', service({
    model: Company,
    id: 'id',
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
  }))

let _ids = {}
let people = app.service('people')
let companies = app.service('companies')

function clean (done) {
  db.schema.dropTableIfExists('people').then(() => {
    return db.schema.createTable('people', table => {
      table.increments('id')
      table.string('name')
      table.integer('age')
      table.integer('time')
      table.boolean('created')
    })
  }).then(() => {
    return db.schema.dropTableIfExists('companies').then(() => {
      db.schema.createTable('companies', table => {
        table.increments('id')
        table.string('name')
        table.integer('ceo')
      })
        .then(() => {
          done()
        })
    })
  })
}

describe('Feathers Objection Service', () => {
  before(clean)
  after(clean)

  describe('Initialization', () => {
    describe('when missing options', () => {
      it('throws an error', () => {
        expect(service.bind(null)).to.throw('Objection options have to be provided')
      })
    })

    describe('when missing a Model', () => {
      it('throws an error', () => {
        expect(service.bind(null, {})).to.throw(/You must provide an Objection Model/)
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
        expect(people.allowedEager).to.equal('')
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
    beforeEach(done => {
      people.create({
        name: 'Doug',
        age: 32
      }).then(data => {
        _ids.Doug = data.id
        done()
      }, done)
    })

    afterEach(done => people.remove(_ids.Doug, {})
      .then(() => done(), () => done()))

    it('is CommonJS compatible', () => {
      assert.equal(typeof require('../lib'), 'function')
    })

    base(people, _ids, errors)
  })

  describe('Able to get service model', () => {
    it('gets the service model', () => {
      expect(people.model).to.equal(People)
    })
  })

  describe('Eager queries', () => {
    beforeEach(done => {
      people.create({
        name: 'Snoop',
        age: 20
      }).then(data => {
        return companies.create([{
          name: 'Google',
          ceo: data.id
        }, {
          name: 'Apple',
          ceo: data.id
        }]).then(() => done())
      }, done)
    })

    it('allows eager queries', done => {
      companies.find({ query: { $eager: 'ceos' } })
        .then(data => {
          expect(data[0].ceos).to.be.ok
          done()
        })
    })

    it('allows eager queries with named filters', done => {
      companies.find({ query: { $eager: 'ceos(notSnoop)' } })
        .then(data => {
          expect(data[0].ceos).to.be.null
          done()
        })
    })

    it('disallow eager queries', done => {
      companies.find({ query: { $eager: 'employees' } })
        .then(data => {
          throw new Error('Should not reach here')
        })
        .catch(error => {
          expect(error.statusCode).to.equal(400)
          expect(JSON.parse(error.message)).to.deep.equal({
            eager: 'eager expression not allowed'
          })
          done()
        })
    })
  })
})

describe.skip('Objection service ORM errors', () => {
  orm(people, _ids, errors)
})

describe('Objection service example test', () => {
  after(done => server.close(() => done()))

  example()
})
