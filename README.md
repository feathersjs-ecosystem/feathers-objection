# feathers-objection

[![Build Status](https://travis-ci.org/mcchrish/feathers-objection.svg?branch=master)](https://travis-ci.org/mcchrish/feathers-objection)
[![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](https://standardjs.com/)
[![Dependency Status](https://img.shields.io/david/mcchrish/feathers-objection.svg)](https://david-dm.org/mcchrish/feathers-objection)
[![npm](https://img.shields.io/npm/v/feathers-objection.svg?maxAge=2592000)](https://www.npmjs.com/package/feathers-objection)

> An [Objection.js](https://vincit.github.io/objection.js) service adapter for [FeathersJS](https://feathersjs.com)


## Installation

```bash
npm install feathers-objection --save
```

## Documentation

Please refer to the [Feathers database adapter documentation](https://docs.feathersjs.com/databases/readme.html) for more details or directly at:

- [Extending](https://docs.feathersjs.com/databases/extending.html) - How to extend a database adapter
- [Pagination and Sorting](https://docs.feathersjs.com/databases/pagination.html) - How to use pagination and sorting for the database adapter
- [Querying](https://docs.feathersjs.com/databases/querying.html) - The common adapter querying mechanism

Refer to the official [Objection.js documention](https://vincit.github.io/objection.js).

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

#### Options

Note that all this eager related options are optional.

* **`allowedEager`** - relation expression to limit the allowed eager queries in
  the service. Defaults to `'[]'`, meaning no eager queries allowed. See [`allowEager`](https://vincit.github.io/objection.js/#alloweager) documentation.
* **`eagerFilters`** - option to impose compulsory eager filter. It takes an
  object or array of objects with the following properties:
  * `expression` - the relation expression that the filter will be applied.
  * `filter` - the filter function.
  It uses [`filterEager`](https://vincit.github.io/objection.js/#filtereager) internally.
* **`namedEagerFilters`** - object containing named eager filter functions.
  Filter is opt-in via `$eager` parameter.

#### Service call parameters

* **`$eager`** - parameter to eager load relations defined in `namedEagerFilters`. See 
  [`eager`](https://vincit.github.io/objection.js/#eager) documentation.
* **`$joinRelation`** - parameter to filter based on a relation's field. See 
  [`joinRelation`](https://vincit.github.io/objection.js/#joinrelation) documentation.
* **`$joinEager`** - parameter to filter based on a relation's field using `JoinEagerAlgorithm`. See 
    [`$joinEager`](https://vincit.github.io/objection.js/#joineager) documentation.
* **`$pick`** - parameter to pick properties from result models. See
  [`pick`](https://vincit.github.io/objection.js/#pick) documentation.

Example:

```js
app.use('/todos', service({
  model: Todo,
  allowedEager: 'subtask',
  namedEagerFilters: {
    unDone: function (builder) {
      builder.where('done', false)
    }
  },
  eagerFilters: [
    {
      expression: 'subtask',
      filter: function (builder) {
        builder.where('archived', true)
      }
    }
  ]
})

```

Use eager queries as follows:
```js
// Get all todos and their unfinished tasks
app.service('/todos').find({
  query: {
    'user.name': 'John',
    $eager: 'subtask(unDone), user',
    $joinRelation: 'subtask(unDone), user'
  }
})
```

See [this
article](https://www.vincit.fi/blog/nested-eager-loading-and-inserts-with-objection-js/)
for more information.

### Composite primary keys

Composite primary keys can be passed as the `id` argument using the following methods:

* String with values separated by the `idSeparator` property (order matter, recommended for REST)
* JSON array (order matter, recommended for internal service calls)
* JSON object (more readable, recommended for internal service calls)

When calling a service method with the `id` argument, all primary keys are required to be passed.

#### Options

* **`id`** - (optional) define custom `id` as string or array of string for composite primary keys. Defaults to `'id'`.
* **`idSeparator`** - (optional) separator char to separate Composite primary keys in the `id` argument 
  of a get/patch/update/remove external service calls. Defaults to `','`.
  
```js
app.use('/user-todos', service({
  id: ['userId', 'todoId'],
  idSeparator: ','
})

app.service('/user-todos').get('1,2');
app.service('/user-todos').get([1, 2]);
app.service('/user-todos').get({ userId: 1, todoId: 2 });
```  


## Complete Example

Here's a complete example of a Feathers server with a `todos` SQLite service. We are using the [Knex schema builder](https://knexjs.org/#Schema).

```js
import feathers from '@feathersjs/feathers'
import express from '@feathersjs/express'
import rest from '@feathersjs/express/rest'
import bodyParser from 'body-parser'
import ObjectionService from '../lib'
import { Model } from 'objection'

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

## Credits

This adapter is mainly a fork of the Knex feathers adapter by the Feathers team.

## License

Copyright © 2016

Licensed under the [MIT license](LICENSE).
