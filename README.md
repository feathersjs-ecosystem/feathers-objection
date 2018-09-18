# feathers-objection

[![Build Status](https://travis-ci.org/mcchrish/feathers-objection.svg?branch=master)](https://travis-ci.org/mcchrish/feathers-objection)
[![Coverage Status](https://coveralls.io/repos/github/mcchrish/feathers-objection/badge.svg?branch=master)](https://coveralls.io/github/mcchrish/feathers-objection?branch=master)
[![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](https://standardjs.com/)
[![Dependency Status](https://img.shields.io/david/mcchrish/feathers-objection.svg)](https://david-dm.org/mcchrish/feathers-objection)
[![npm](https://img.shields.io/npm/v/feathers-objection.svg?maxAge=3600)](https://www.npmjs.com/package/feathers-objection)

> An [Objection.js](https://vincit.github.io/objection.js) service adapter for [FeathersJS](https://feathersjs.com)


## Installation

```bash
npm install --save feathers-objection
npm install --save objection
npm install --save knex
```

## Documentation

Please refer to the [Feathers database adapter documentation](https://docs.feathersjs.com/api/databases/adapters.html) for more details or directly at:

- [Querying](https://docs.feathersjs.com/api/databases/querying.html) - The common adapter querying mechanism
- [Pagination and Sorting](https://docs.feathersjs.com/api/databases/common.html#pagination) - How to use pagination and sorting for the database adapter
- [Extending](https://docs.feathersjs.com/api/databases/common.html#extending-adapters) - How to extend a database adapter

Refer to the official [Objection.js documention](https://vincit.github.io/objection.js/).

It works almost the same as the [Knex
service](https://github.com/feathersjs-ecosystem/feathers-knex) adapter, except it has all
the benefits of the Objection ORM.

### Knex

config/defaults.json
```js
{
  "mysql": {
    "host": "mysql.example.com",
    "user": "root",
    "password": "secret",
    "database": "example"
  }
}
```  

knex.js
```js
const { Model } = require('objection');

module.exports = function (app) {
  const connectionInfo = app.get('mysql');
  const knex = require('knex')({
    client: 'mysql',
    useNullAsDefault: false,
    connection: connectionInfo,
  });

  Model.knex(knex);

  app.set('knex', knex);
};
```

### Models

Objection requires you to define Models for your tables:

users.model.js
```js
const { Model } = require('objection');

class User extends Model {

  static get tableName() {
    return 'user';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['firstName', 'lastName'],

      properties: {
        id: { type: 'integer' },
        firstName: { type: 'string', maxLength: 45 },
        lastName: { type: 'string', maxLength: 45 },
        status: { type: 'string', enum: ['active', 'disabled'], default: 'active' },
      },
    };
  }

  static get relationMappings() {
    const Todo = require('./todos.model');

    return {
      todos: {
        relation: Model.HasManyRelation,
        modelClass: Todo,
        join: {
          from: 'user.id',
          to: 'todo.userId',
        },
      },
    };
  }

  static get namedFilters() {
    return {
      active: builder => {
        builder.where('status', 'active');
      },
    };
  }

  $beforeInsert() {
    this.createdAt = this.updatedAt = new Date().toISOString();
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString();
  }

}

module.exports = User;
```

todos.model.js
```js
const { Model } = require('objection');

class Todo extends Model {

  static get tableName() {
    return 'todo';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['userId', 'text'],

      properties: {
        id: { type: 'integer' },
        userId: { type: 'integer' },
        text: { type: 'string' },
        complete: { type: 'boolean', default: false },
      },
    };
  }

  static get relationMappings() {
    const User = require('./users.model');

    return {
      user: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'todo.userId',
          to: 'user.id',
        },
      },
    };
  }

  $beforeInsert() {
    this.createdAt = this.updatedAt = new Date().toISOString();
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString();
  }

}

module.exports = Todo;
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

* **`$eager`** - parameter to eager load relations defined in models' `relationMappings` 
  getter methods or in the `namedEagerFilters` option. See 
  [`eager`](https://vincit.github.io/objection.js/#eager) documentation.
* **`$joinRelation`** - parameter to filter based on a relation's field. See 
  [`joinRelation`](https://vincit.github.io/objection.js/#joinrelation) documentation.
* **`$joinEager`** - parameter to filter based on a relation's field using `JoinEagerAlgorithm`. See 
    [`$joinEager`](https://vincit.github.io/objection.js/#joineager) documentation.
* **`$pick`** - parameter to pick properties from result models. See
  [`pick`](https://vincit.github.io/objection.js/#pick) documentation.

### Service

users.service.js
```js
const createService = require('feathers-objection');
const model = require('../../models/users.model');
const hooks = require('./users.hooks');

module.exports = function (app) {
  const paginate = app.get('paginate');

  const options = {
    model,
    paginate,
    allowedEager: 'todos',
  };

  app.v2.use('/users', createService(options));

  const service = app.v2.service('users');

  service.hooks(hooks);
};
```

todos.service.js
```js
const createService = require('feathers-objection');
const model = require('../../models/todos.model');
const hooks = require('./todos.hooks');

module.exports = function (app) {
  const paginate = app.get('paginate');

  const options = {
    model,
    paginate,
    allowedEager: '[user, subtask]',
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
  };

  app.v2.use('/todos', createService(options));

  const service = app.v2.service('todos');

  service.hooks(hooks);
};
```

Use eager queries as follows:
```js
// Get all todos and their unfinished tasks
app.service('/todos').find({
  query: {
    $eager: 'subtask(unDone)',
  }
})

// Get all todos of an active user with firstName 'John'
app.service('/todos').find({
  query: {
    'user.firstName': 'John',
    $eager: 'user(active)',
    $joinRelation: 'user(active)'
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

* **`id`** - (optional) define custom `id` as string or array of strings for Composite primary keys. Defaults to `'id'`.
* **`idSeparator`** - (optional) separator char to separate Composite primary keys in the `id` argument 
  of get/patch/update/remove external service calls. Defaults to `','`.
  
```js
app.use('/user-todos', service({
  id: ['userId', 'todoId'],
  idSeparator: ','
})

app.service('/user-todos').get('1,2');
app.service('/user-todos').get([1, 2]);
app.service('/user-todos').get({ userId: 1, todoId: 2 });
```  

### Graph upsert
Arbitrary relation graphs can be upserted (insert + update + delete) using the upsertGraph method.
See [`examples`](https://vincit.github.io/objection.js/#graph-upserts) for a better explanation.
Runs on the `.update(id, data, params)` service method. 

*The relation being upserted must also be present in `allowedEager` option and included in `$eager` query.*

#### Options

* **`allowedUpsert`** - relation expression to allow relations to be upserted along with update. 
Defaults to `null`, meaning relations will not be automatically upserted unless specified here. 
See [`allowUpsert`](https://vincit.github.io/objection.js/#allowupsert) documentation.
* **`upsertGraphOptions`** - See [`upsertGraphOptions`](https://vincit.github.io/objection.js/#upsertgraphoptions) documentation.
* **`createUseUpsertGraph`** - If set to `true`, Graph Upsert will also be used for `.create(data, params)` method instead of Graph Insert.

```js
app.use('/companies', service({
  model: Company,
  allowedEager: 'clients',
  allowedUpsert: 'clients'
})

app.service('/companies').update(1, { 
  name: 'New Name',
  clients: [{
    id: 100,
    name: 'Existing Client'
  }, {
    name: 'New Client'
  }]
})
```

In the example above, we are updating the name of an existing company, along with adding a new client which is a relationship for companies. The client without the ID would be inserted and related. The client with the ID will just be updated (if there are any changes at all).

### Graph insert
Arbitrary relation graphs can be inserted using the insertGraph method.
Provides the ability to relate the inserted object with its associations.
Runs on the `.create(data, params)` service method. 

*The relation being created must also be present in `allowedEager` option and included in `$eager` query.*

#### Options

* **`allowedInsert`** - relation expression to allow relations to be created along with insert. 
Defaults to `null`, meaning relations will not be automatically created unless specified here. 
See [`allowInsert`](https://vincit.github.io/objection.js/#allowinsert) documentation.
* **`insertGraphOptions`** - See [`insertGraphOptions`](https://vincit.github.io/objection.js/#insertgraphoptions) documentation.

## Complete Example

Here's a complete example of a Feathers server with a `todos` SQLite service. We are using the [Knex schema builder](https://knexjs.org/#Schema).

```js
const feathers = require('@feathersjs/feathers')
const express = require('@feathersjs/express')
const rest = require('@feathersjs/express/rest')
const errorHandler = require('@feathersjs/express/errors')
const bodyParser = require('body-parser')
const ObjectionService = require('feathers-objection')
const { Model } = require('objection')

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
knex.schema.dropTableIfExists('todo').then(function () {
  console.log('Dropped todo table')

  // Initialize your table
  return knex.schema.createTable('todo', function (table) {
    console.log('Creating todo table')
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

  static get tableName() {
    return 'todo'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['text'],

      properties: {
        id: { type: 'integer' },
        text: { type: 'string' },
        complete: { type: 'boolean' }
      }
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

// Handle Errors
app.use(errorHandler())

// Start the server
module.exports = app.listen(3030)

console.log('Feathers Todo Objection service running on 127.0.0.1:3030')
```

You can run this example by using `node server` and going to [http://localhost:3030/todos](http://localhost:3030/todos). You should see an empty array. That's because you don't have any Todos yet but you now have full CRUD for your new todos service!

## Credits

This adapter is mainly a fork of the Knex feathers adapter by the Feathers team.

## License

Copyright © 2016

Licensed under the [MIT license](LICENSE).
