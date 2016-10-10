/* eslint-env mocha */
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
    id: 'id',
    events: ['testing']
  }))
  .use('/people-customid', service({
    model: PeopleCustomid,
    id: 'customid',
    events: [ 'testing' ]
  }))
  .use('/companies', service({
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
  }))

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
    return db.schema.dropTableIfExists('people-customid').then(() => {
      return db.schema.createTable('people-customid', table => {
        table.increments('customid')
        table.string('name')
        table.integer('age')
        table.integer('time')
        table.boolean('created')
      })
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
        assert.equal(typeof require('../lib'), 'function')
    )

    base(app, errors, 'people')
    base(app, errors, 'people-customid', 'customid')
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

    it('allows eager queries', () => {
      return companies.find({ query: { $eager: 'ceos' } })
        .then(data => {
          expect(data[0].ceos).to.be.ok
        })
    })

    it('allows eager queries with named filters', () => {
      return companies.find({ query: { $eager: 'ceos(notSnoop)' } })
        .then(data => {
          expect(data[0].ceos).to.be.null
        })
    })

    it('disallow eager queries', () => {
      return companies.find({ query: { $eager: 'employees' } })
        .then(data => {
          throw new Error('Should not reach here')
        })
        .catch(error => {
          expect(error.statusCode).to.equal(400)
          expect(JSON.parse(error.message)).to.deep.equal({
            eager: 'eager expression not allowed'
          })
        })
    })
  })
})

describe('Objection service example test', () => {
  after(done => server.close(() => done()))

  example()
})
