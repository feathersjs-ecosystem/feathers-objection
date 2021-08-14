// See https://vincit.github.io/objection.js/#models
// for more of what you can do here.
const { Model } = require('objection')

class UsersModel extends Model {
  static get tableName() {
    return 'user'
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
    }
  }

  static get relationMappings() {
    const Todo = require('./todos.model')()

    return {
      todos: {
        relation: Model.HasManyRelation,
        modelClass: Todo,
        join: {
          from: 'user.id',
          to: 'todo.userId'
        }
      }
    }
  }

  static get modifiers() {
    return {
      active: builder => {
        builder.where('status', 'active')
      }
    }
  }

  $beforeInsert() {
    this.createdAt = this.updatedAt = new Date().toISOString()
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }
}

module.exports = function (app) {
  if (app) {
    const db = app.get('knex')

    // Clean up our data. This is optional and is here
    // because of our integration tests
    db.schema.dropTableIfExists('user').then(function () {
      console.log('Dropped user table')
    })

    db.schema
      .hasTable('user')
      .then(exists => {
        if (!exists) {
          db.schema
            .createTable('user', table => {
              table.increments('id')
              table.string('firstName', 45)
              table.string('lastName', 45)
              table.enum('status', ['active', 'disabled']).defaultTo('active')
              table.timestamp('createdAt')
              table.timestamp('updatedAt')
            })
            .then(() => console.log('Created user table'))
            .catch(e => console.error('Error creating user table', e))
        }
      })
      .catch(e => console.error('Error creating user table', e))
  }

  return UsersModel
}
