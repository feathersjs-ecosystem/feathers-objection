# feathers-objection

[![Build Status](https://travis-ci.org/feathersjs-ecosystem/feathers-objection.svg?branch=master)](https://travis-ci.org/feathersjs-ecosystem/feathers-objection)
[![Coverage Status](https://coveralls.io/repos/github/feathersjs-ecosystem/feathers-objection/badge.svg?branch=master)](https://coveralls.io/github/feathersjs-ecosystem/feathers-objection?branch=master)
[![js-semistandard-style](https://img.shields.io/badge/code%20style-semistandard-brightgreen.svg?style=flat-square)](https://github.com/standard/semistandard)
[![Dependency Status](https://img.shields.io/david/feathersjs-ecosystem/feathers-objection.svg)](https://david-dm.org/feathersjs-ecosystem/feathers-objection)
[![npm](https://img.shields.io/npm/v/feathers-objection.svg?maxAge=3600)](https://www.npmjs.com/package/feathers-objection)

[Feathers](https://feathersjs.com/) database adapter for
[Objection.js](https://vincit.github.io/objection.js), an ORM based on
[KnexJS](https://knexjs.org/) SQL query builder for Postgres, MSSQL, MySQL,
MariaDB, SQLite3, and Oracle.

## Installation

```
npm install --save feathers-objection
npm install --save objection
npm install --save knex
```

Then add one of the following:

```
npm install --save pg
npm install --save sqlite3
npm install --save mysql
npm install --save mysql2
npm install --save oracle
npm install --save mssql
```

If you want to use a MariaDB instance, you can use the mysql driver.

### [Feathers CLI](https://github.com/feathersjs/feathers/tree/master/packages/cli)

Use `feathers generate service` command to generate a new `Objection` service.

## Documentation

Please refer to the
[Feathers database adapter documentation](https://docs.feathersjs.com/api/databases/adapters.html)
for more details or directly at:

- [Querying](https://docs.feathersjs.com/api/databases/querying.html) - The
  common adapter querying mechanism
- [Pagination and Sorting](https://docs.feathersjs.com/api/databases/common.html#pagination) -
  How to use pagination and sorting for the database adapter
- [Extending](https://docs.feathersjs.com/api/databases/common.html#extending-adapters) -
  How to extend a database adapter

Refer to the official
[Objection.js documention](https://vincit.github.io/objection.js/).

It works like the
[Knex service](https://github.com/feathersjs-ecosystem/feathers-knex) adapter,
except it has all the benefits of the Objection ORM.

### [Initializing the Library](https://knexjs.org/#Installation-client)

config/defaults.json

```js
{
  "mysql": {
    "client": "mysql2",
    "connection": {
      "host": "mysql.example.com",
      "user": "root",
      "password": "secret",
      "database": "example"
    }
  }
}
```

objection.js

```js
const { Model } = require('objection');

module.exports = function(app) {
  const { client, connection } = app.get('mysql');
  const knex = require('knex')({ client, connection, useNullAsDefault: false });

  Model.knex(knex);

  app.set('knex', knex);
};
```

### Service Options

- `model` (**required**) - The Objection model definition
- `id` (_optional_, default: `model.idColumn` or `'id'`) - The name of the id field property. Use
  array of strings for composite primary keys
- `events` (_optional_) - A list of
  [custom service events](https://docs.feathersjs.com/api/events.html#custom-events)
  sent by this service
- `paginate` (_optional_) - A
  [pagination object](https://docs.feathersjs.com/api/databases/common.html#pagination)
  containing a `default` and `max` page size
- `multi` (_optional_) - Allow `create` with arrays and `update` and `remove`
  with `id` `null` to change multiple items. Can be `true` for all methods or an
  array of allowed methods (e.g. `[ 'remove', 'create' ]`)
- `whitelist` (_optional_) - A list of additional query operators to allow (e.g.
  `[ '$eager', '$joinRelation' ]`)

### Default Query Operators

Starting at version 2.0.0 `feathers-objection` converts queries securely. If you
want to support additional Objection operators, the `whitelist` service option
can contain an array of additional allowed operators. By default, supported
operators are:

```
'$eq',
'$ne',
'$gte',
'$gt',
'$lte',
'$lt',
'$in',
'$nin',
'$like',
'$notLike',
'$ilike',
'$notILike',
'$or',
'$and'
```

### Eager Queries

Eager queries is one way of solving the SQL database relational model in
Feathers services, instead of relying with hooks.

#### Service Options

Note that all this eager related options are optional.

- **`allowedEager`** - relation expression to limit the allowed eager queries in
  the service. Defaults to `'[]'`, meaning no eager queries allowed. See
  [`allowEager`](https://vincit.github.io/objection.js/api/query-builder/eager-methods.html#alloweager)
  documentation.
- **`eagerFilters`** - option to impose compulsory eager filter. It takes an
  object or array of objects with the following properties:
  - `expression` - the relation expression that the filter will be applied.
  - `filter` - the filter function. It uses
    [`modifyEager`](https://vincit.github.io/objection.js/api/query-builder/eager-methods.html#modifyeager)
    internally.
- **`namedEagerFilters`** - object containing named eager filter functions.
  Filter is opt-in via `$eager` parameter.

#### Query Operators

- **`$eager`** - eager load relations defined in models'
  `relationMappings` getter methods or in the `namedEagerFilters` option. See
  [`eager`](https://vincit.github.io/objection.js/api/query-builder/eager-methods.html#eager) documentation.
- **`$joinRelation`** - filter based on a relation's field. See
  [`joinRelation`](https://vincit.github.io/objection.js/api/query-builder/join-methods.html#joinrelation)
  documentation.
- **`$joinEager`** - filter based on a relation's field using
  `JoinEagerAlgorithm`. See
  [`$joinEager`](https://vincit.github.io/objection.js/api/query-builder/eager-methods.html#joineager)
  documentation.
- **`$modifyEager`** - filter relation based on a relation's field,
  e.g. `companies.find({ query: { $eager: 'employees', $modifyEager: { employees: { name: 'John' } } } })`
- **`$mergeEager`** - merge an eager expression to `$eager`,
  e.g. `companies.find({ query: { $eager: 'employees', $mergeEager: 'ceos' } })`
- **`$pick`** - pick properties from result models. See
  [`pick`](https://vincit.github.io/objection.js/api/query-builder/other-methods.html#pick) documentation.
  
- **`$select`** - add SELECT statement with given array of column names. See
    [`$select`](https://vincit.github.io/objection.js/api/query-builder/find-methods.html#select) documentation.

- **`$noSelect`** - skips SELECT queries in create, patch & remove requests. response data will be based on the input data.

- **`$between`** - filter based on if a column value is between range of values

- **`$notBetween`** - filter based on if a column value is not between range of values  

- **`$like`** - filter column value based on a LIKE pattern

- **`$notLike`** - filter column value based on a NOT LIKE pattern

- **`$regexp`** - filter column value based on a REGEXP pattern

- **`$notRegexp`** - filter column value based on a NOT REGEXP pattern

- **`$ilike`** - (Postgres) filter column value based on a case-insensitive LIKE pattern

- **`$notILike`** - (Postgres) filter column value based on a case-insensitive NOT LIKE pattern

- **`$iRegexp`** - (Postgres) filter column value based on a case-insensitive REGEXP pattern

- **`$notIRegexp`** - (Postgres) filter column value based on a case-insensitive NOT REGEXP pattern
  
- **`$containsKey`** (Postgres) - filter based on if a column contains a key

- **`$any`** (Postgres) - filter based on if a column contains any key from array of strings

- **`$all`** (Postgres) - filter based on if a column contains all keys from array of strings

- **`$contains`** (Postgres) - filter based on if a column contains all values from array of values

- **`$contained`** (Postgres) - filter based on if a column is contained within a serialized object

#### Params Operators

- **`transaction`** - A transaction object. See
  [`transaction`](https://vincit.github.io/objection.js/api/objection/#transaction)
  documentation.

- **`mergeAllowEager`** - Just like allowEager but instead of replacing query
  builder’s allowEager expression this method merges the given expression to the
  existing expression. See
  [`mergeAllowEager`](https://vincit.github.io/objection.js/api/query-builder/eager-methods.html#mergealloweager)
  documentation.

### Composite primary keys

Composite primary keys can be passed as the `id` argument using the following
methods:

- String with values separated by the `idSeparator` property (order matter,
  recommended for REST)
- JSON array (order matter, recommended for internal service calls)
- JSON object (more readable, recommended for internal service calls)

When calling a service method with the `id` argument, all primary keys are
required to be passed.

#### Service Options

- **`idSeparator`** - (optional) separator char to separate composite primary
  keys in the `id` argument of get/patch/update/remove external service calls.
  Defaults to `','`.

```js
app.use('/user-todos', service({
  id: ['userId', 'todoId'],
  idSeparator: ','
})

app.service('/user-todos').get('1,2')
app.service('/user-todos').get([1, 2])
app.service('/user-todos').get({ userId: 1, todoId: 2 })
```

### JSON column

JSON column will be automatically converted from and to JS object/array and will
be saved as text in unsupported databases. it must be defined in the model class.

Query against a JSON column in PostgresSQL:

```js
app.service('companies').find({
  query: {
    obj: { stringField: 'string' }
  }
});

app.service('companies').find({
  query: {
    obj: { numberField: 1.5 }
  }
});

app.service('companies').find({ 
  query: {
    obj: { numberField: { $gt: 1.5 } }
  }
});

app.service('companies').find({
  query: {
    obj: { 'objectField.object': 'string in obj.objectField.object' }
  }
});

app.service('companies').find({
  query: {
    obj: { 'arrayField(0).object': 'string in obj.arrayField[0].object' }
  }
});

app.service('companies').find({
  query: {
    arr: { '(0).objectField.object': 'string in arr[0].objectField.object' }
  }
});

app.service('companies').find({
  query: {
    obj: { "(field.WithDot)": 'string' }
  }
});
```

### Graph upsert

Arbitrary relation graphs can be upserted (insert + update + delete) using the
upsertGraph method. See
[`examples`](https://vincit.github.io/objection.js/guide/query-examples.html#graph-upserts) for a better
explanation.  
Runs on `update` and `patch` service methods when `id` is set.

_The relation being upserted must also be present in `allowedEager` option and
included in `$eager` query when using the `update` service method._

#### Service Options

- **`allowedUpsert`** - relation expression to allow relations to be upserted
  along with update. Defaults to `null`, meaning relations will not be
  automatically upserted unless specified here. See
  [`allowUpsert`](https://vincit.github.io/objection.js/api/query-builder/mutate-methods.html#allowupsert)
  documentation.
- **`upsertGraphOptions`** - See
  [`upsertGraphOptions`](https://vincit.github.io/objection.js/api/types/#type-upsertgraphoptions)
  documentation.
- **`createUseUpsertGraph`** - If set to `true`, Graph Upsert will also be used
  for `.create(data, params)` method instead of Graph Insert.

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

In the example above, we are updating the name of an existing company, along
with adding a new client which is a relationship for companies. The client
without the ID would be inserted and related. The client with the ID will just
be updated (if there are any changes at all).

#### Params Operators

- **`mergeAllowUpsert`** - Merge given expression into `allowedUpsert`.

### Graph insert

Arbitrary relation graphs can be inserted using the insertGraph method. Provides
the ability to relate the inserted object with its associations. Runs on the
`.create(data, params)` service method.

_The relation being created must also be present in `allowedEager` option and
included in `$eager` query._

#### Service Options

- **`allowedInsert`** - relation expression to allow relations to be created
  along with insert. Defaults to `null`, meaning relations will not be
  automatically created unless specified here. See
  [`allowInsert`](https://vincit.github.io/objection.js/api/query-builder/mutate-methods.html#allowinsert)
  documentation.
- **`insertGraphOptions`** - See
  [`insertGraphOptions`](https://vincit.github.io/objection.js/api/types/#type-insertgraphoptions)
  documentation.

#### Params Operators

- **`mergeAllowInsert`** - Merge given expression into `allowedInsert`.

### Transaction

[Create a transaction](https://vincit.github.io/objection.js/guide/transactions.html#creating-a-transaction) 
object and pass it to series of service calls using the `transaction` params operator.  
Commit the transaction by calling `await transaction.trx.commit()`.  
Rollback by calling `await transaction.trx.rollback()`.

### Service

users.service.js

```js
const createService = require('feathers-objection');
const createModal = require('../../models/users.model');
const hooks = require('./users.hooks');

module.exports = function(app) {
  const Modal = createModal(app);
  const paginate = app.get('paginate');

  const options = {
    model: Modal,
    paginate,
    whitelist: ['$eager', '$joinRelation'],
    allowedEager: 'todos'
  };

  app.use('/users', createService(options));

  const service = app.service('users');

  service.hooks(hooks);
};
```

todos.service.js

```js
const createService = require('feathers-objection');
const createModal = require('../../models/todos.model');
const hooks = require('./todos.hooks');

module.exports = function(app) {
  const Modal = createModal(app);
  const paginate = app.get('paginate');

  const options = {
    model: Modal,
    paginate,
    whitelist: ['$eager', '$joinRelation'],
    allowedEager: '[user, subtask]',
    namedEagerFilters: {
      unDone: function(builder) {
        builder.where('done', false);
      }
    },
    eagerFilters: [
      {
        expression: 'subtask',
        filter: function(builder) {
          builder.where('archived', true);
        }
      }
    ]
  };

  app.use('/todos', createService(options));

  const service = app.service('todos');

  service.hooks(hooks);
};
```

Use eager queries as follows:

```js
// Get all todos and their unfinished tasks
app.service('/todos').find({
  query: {
    $eager: 'subtask(unDone)'
  }
});

// Get all todos of an active user with firstName 'John'
app.service('/todos').find({
  query: {
    'user.firstName': 'John',
    $eager: 'user(active)',
    $joinRelation: 'user(active)'
  }
});
```

See
[this article](https://www.vincit.fi/blog/nested-eager-loading-and-inserts-with-objection-js/)
for more information.

### Models

Objection requires you to define
[Models](https://vincit.github.io/objection.js/api/model/#models) with [JSON Schema](https://json-schema.org/understanding-json-schema/) format for your tables:

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
        status: {
          type: 'string',
          enum: ['active', 'disabled'],
          default: 'active'
        },
        address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
            zipCode: { type: 'string' }
          }
        },
        list: {
          type: 'array',
          maxItems: 3,
          items: { type: 'string' }
        }
      }
    };
  }

  static get relationMappings() {
    const Todo = require('./todos.model')();

    return {
      todos: {
        relation: Model.HasManyRelation,
        modelClass: Todo,
        join: {
          from: 'user.id',
          to: 'todo.userId'
        }
      }
    };
  }

  static get namedFilters() {
    return {
      active: builder => {
        builder.where('status', 'active');
      }
    };
  }

  $beforeInsert() {
    this.createdAt = this.updatedAt = new Date().toISOString();
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString();
  }
}

module.exports = function(app) {
  if (app) {
    const db = app.get('knex');

    db.schema
      .hasTable('user')
      .then(exists => {
        if (!exists) {
          db.schema
            .createTable('user', table => {
              table.increments('id');
              table.string('firstName', 45);
              table.string('lastName', 45);
              table.enum('status', ['active', 'disabled']).defaultTo('active');
              table.timestamp('createdAt');
              table.timestamp('updatedAt');
            })
            .then(() => console.log('Created user table'))
            .catch(e => console.error('Error creating user table', e));
        }
      })
      .catch(e => console.error('Error creating user table', e));
  }

  return User;
};

module.exports = User;
```

todos.model.js

```js
const { Model } = require('objection');

class Todo extends Model {
  static setup(app) {
    this.app = app;
  }

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
        text: { type: 'string', maxLength: 500 },
        complete: { type: 'boolean', default: false },
        dueDate: { type: 'string', format: 'date-time' }
      }
    };
  }

  static get relationMappings() {
    const User = require('./users.model')();

    return {
      user: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'todo.userId',
          to: 'user.id'
        }
      }
    };
  }

  static get namedFilters() {
    const knex = this.app.get('knex');

    return {
      overdue: builder => {
        builder
          .where('complete', '=', false)
          .where('dueDate', '<', knex.fn.now());
      }
    };
  }

  $beforeInsert() {
    this.createdAt = this.updatedAt = new Date().toISOString();
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString();
  }
}

module.exports = function(app) {
  if (app) {
    Todo.setup(app);

    const db = app.get('knex');

    db.schema
      .hasTable('todo')
      .then(exists => {
        if (!exists) {
          db.schema
            .createTable('todo', table => {
              table.increments('id');
              table.integer('userId');
              table.string('text', 500);
              table.boolean('complete');
              table.timestamp('dueDate');
              table.timestamp('createdAt');
              table.timestamp('updatedAt');
            })
            .then(() => console.log('Created todo table'))
            .catch(e => console.error('Error creating todo table', e));
        }
      })
      .catch(e => console.error('Error creating todo table', e));
  }

  return Todo;
};
```

## Complete Example

Here's a complete example of a Feathers server with a `todos` SQLite service:

`$ npm install @feathersjs/feathers @feathersjs/express body-parser feathers-objection objection knex sqlite3`

app.js

```js
const feathers = require('@feathersjs/feathers');
const express = require('@feathersjs/express');
const rest = require('@feathersjs/express/rest');
const errorHandler = require('@feathersjs/express/errors');
const bodyParser = require('body-parser');
const createService = require('feathers-objection');
const { Model } = require('objection');

const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: './db.sqlite'
  },
  useNullAsDefault: false
});

// Bind Objection.js
Model.knex(knex);

// Clean up our data. This is optional and is here
// because of our integration tests
knex.schema.dropTableIfExists('todo').then(function() {
  console.log('Dropped todo table');

  // Initialize your table
  return knex.schema.createTable('todo', function(table) {
    console.log('Creating todo table');
    table.increments('id');
    table.string('text');
    table.boolean('complete');
    table.timestamp('createdAt');
    table.timestamp('updatedAt');
  });
});

// Create a feathers instance.
const app = express(feathers())
  // Enable REST services
  .configure(rest())
  // Turn on JSON parser for REST services
  .use(bodyParser.json())
  // Turn on URL-encoded parser for REST services
  .use(bodyParser.urlencoded({ extended: true }));

// Create an Objection Model
class Todo extends Model {
  static get tableName() {
    return 'todo';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['text'],

      properties: {
        id: { type: 'integer' },
        text: { type: 'string' },
        complete: { type: 'boolean', default: false }
      }
    };
  }

  $beforeInsert() {
    this.createdAt = this.updatedAt = new Date().toISOString();
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString();
  }
}

// Create Objection Feathers service with a default page size of 2 items
// and a maximum size of 4
app.use(
  '/todos',
  createService({
    model: Todo,
    id: 'id',
    paginate: {
      default: 2,
      max: 4
    }
  })
);

// Handle Errors
app.use(errorHandler());

// Start the server
module.exports = app.listen(3030);

console.log('Feathers Todo Objection service running on 127.0.0.1:3030');
```

Run the example with `node app` and go to
[localhost:3030/todos](http://localhost:3030/todos).

You should see an empty array. That's because you don't have any Todos yet, but
you now have full CRUD for your new todos service!

## DB migrations

[Knex Migration CLI](http://knexjs.org/#Migrations) can be used to manage DB migrations 
and to [seed](http://knexjs.org/#Seeds) a table with mock data.
  
## Error handling

As of version 4.8.0, `feathers-objection` only throws [Feathers Errors](https://docs.feathersjs.com/api/errors.html) 
with the message.  
On the server, the original error can be retrieved through a secure symbol via  `error[require('feathers-objection').ERROR]`.

```js
const { ERROR } = require('feathers-objection');

try {
  await objectionService.doSomething();
} catch (error) {
  // error is a FeathersError with just the message
  // Safely retrieve the original error
  const originalError = error[ERROR];
}
```

## Migrating to `feathers-objection` v2

`feathers-objection` 2.0.0 comes with important security and usability updates.

> **Important:** For general migration information to the new database adapter
> functionality see
> [crow.docs.feathersjs.com/migrating.html#database-adapters](https://crow.docs.feathersjs.com/migrating.html#database-adapters).

The following breaking changes have been introduced:

- All methods allow additional query parameters
- Multiple updates are disabled by default (see the `multi` option)
- Objection related operators are disabled by default (see the `whitelist`
  option)

## License

Copyright © 2019

Licensed under the [MIT license](LICENSE).
