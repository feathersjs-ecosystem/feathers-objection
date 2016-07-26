# feathers-objection

[![Build Status](https://travis-ci.org/mcchrish/feathers-objection.svg?branch=master)](https://travis-ci.org/mcchrish/feathers-objection) [![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/) [![npm](https://img.shields.io/npm/v/feathers-objection.svg?maxAge=2592000)](https://www.npmjs.com/package/feathers-objection)

> An [Objection.js](http://vincit.github.io/objection.js) service adapter for [FeathersJS](http://feathersjs.com)


## Installation

```bash
npm install feathers-objection --save
```

## Documentation

Please refer to the [Feathers database adapter documentation](http://docs.feathersjs.com/databases/readme.html) for more details or directly at:

- [Extending](http://docs.feathersjs.com/databases/extending.html) - How to extend a database adapter
- [Pagination and Sorting](http://docs.feathersjs.com/databases/pagination.html) - How to use pagination and sorting for the database adapter
- [Querying](http://docs.feathersjs.com/databases/querying.html) - The common adapter querying mechanism

Refer to the official [Objection.js documention](http://vincit.github.io/objection.js).

It works almost the same as the [Knex
service](https://github.com/feathersjs/feathers-knex) adapter, except it has all
the benefits of the Objection ORM.

### Models

Objection requires you to define Models for your tables:

```js
// todo.js
class Todo extends Model {
  static tableName = 'todos'

  static jsonSchema = {
    type: 'object',
    required: ['text'],

    properties: {
      id: {type: 'integer'},
      text: {type: 'string'},
      complete: {type: 'boolean'}
    }
  }
}

export default Todo
```

When defining a service, you must provide the model:
```js
app.use('/todos', service({
  model: Todo
})
```

### Eager Queries

Eager queries is one way of solving the SQL database relational model in
Feathers services, instead of relying with hooks.
When defining a service, you must also define the allowed eager queries:

```js
app.use('/todos', service({
  model: Todo,
  allowedEager: 'subtasks'
})
```

See [this
article](https://www.vincit.fi/blog/nested-eager-loading-and-inserts-with-objection-js/)
for more information.


## Complete Example

Here's a complete example of a Feathers server with a `todos` SQLite service. We are using the [Knex schema builder](http://knexjs.org/#Schema).

```js
import feathers from 'feathers'
import rest from 'feathers-rest'
import bodyParser from 'body-parser'
import ObjectionService from '../lib'
import { Model } from 'objection'

const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: './db.sqlite'
  }
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
const app = feathers()
  // Enable REST services
  .configure(rest())
  // Turn on JSON parser for REST services
  .use(bodyParser.json())
  // Turn on URL-encoded parser for REST services
  .use(bodyParser.urlencoded({ extended: true }))

// Create an Objection Model
class Todo extends Model {
  static tableName = 'todos'

  static jsonSchema = {
    type: 'object',
    required: ['text'],

    properties: {
      id: {type: 'integer'},
      text: {type: 'string'},
      complete: {type: 'boolean'}
    }
  }
}

// Create Objection Feathers service with a default page size of 2 items
// and a maximum size of 4
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

console.log('Feathers Todo Objection service running on 127.0.0.1:3030')
```

You can run this example by using `node server` and going to [localhost:3030/todos](http://localhost:3030/todos). You should see an empty array. That's because you don't have any Todos yet but you now have full CRUD for your new todos service!

## Todo
- [x] Eager Queries
- [ ] Use `updateAndFetch`
- [ ] Use `patchAndFetch`
- [ ] Support `insertWithRelated`
- [ ] Use `deleteById`


## Credits

This adapter is mainly a fork of the Knex feathers adapter by the Feathers team.

## License

Copyright © 2016

Licensed under the [MIT license](LICENSE).
