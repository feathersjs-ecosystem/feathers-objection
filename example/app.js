import feathers from '@feathersjs/feathers'
import express from '@feathersjs/express'
import rest from '@feathersjs/express/rest'
import bodyParser from 'body-parser'
import ObjectionService from '../lib'
import { Model } from 'objection'
import Todo from './todo'

const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: './db.sqlite'
  },
  useNullAsDefault: false
})

// Bind Objection.js
Model.knex(knex)

// Clean up our data. This is optional and is here
// because of our integration tests
knex.schema.dropTableIfExists('todos').then(function () {
  console.log('Dropped todos table')

  // Initialize your table
  return knex.schema.createTable('todos', function (table) {
    console.log('Creating todos table')
    table.increments('id')
    table.string('text')
    table.boolean('complete')
  })
})

// Create a feathers instance.
const app = express(feathers())
  // Enable REST services
  .configure(rest())
  // Turn on JSON parser for REST services
  .use(bodyParser.json())
  // Turn on URL-encoded parser for REST services
  .use(bodyParser.urlencoded({ extended: true }))

app.use('/todos', ObjectionService({
  model: Todo,
  id: 'id',
  paginate: {
    default: 2,
    max: 4
  }
}))

app.use(function (error, req, res, next) {
  res.json(error)
})

// Start the server
module.exports = app.listen(3030)

console.log('Feathers Todo Objection service running on 127.0.0.1:3030')
