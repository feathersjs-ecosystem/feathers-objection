import feathers from '@feathersjs/feathers'
import express from '@feathersjs/express'
import rest from '@feathersjs/express/rest'
import errorHandler from '@feathersjs/express/errors'
import bodyParser from 'body-parser'
import { Model } from 'objection'
import createService from '../src'
import createModel from './todo'

// Initialize Knex
const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: './db.sqlite'
  },
  useNullAsDefault: false
})

// Bind Objection.js
Model.knex(knex)

// Create a feathers instance.
const app = express(feathers())
  // Enable REST services
  .configure(rest())
  // Turn on JSON parser for REST services
  .use(bodyParser.json())
  // Turn on URL-encoded parser for REST services
  .use(bodyParser.urlencoded({ extended: true }))

app.set('knex', knex)

// Create service
app.use('/todos', createService({
  model: createModel(app),
  id: 'id',
  paginate: {
    default: 2,
    max: 4
  }
}))

// Handle Errors
app.use(errorHandler())

// Start the server
module.exports = app.listen(3030)

console.log('Feathers Todo Objection service running on 127.0.0.1:3030')
