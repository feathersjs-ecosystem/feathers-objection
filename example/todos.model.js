// See https://vincit.github.io/objection.js/#models
// for more of what you can do here.
import { Model } from 'objection'

class TodosModel extends Model {
  static setup(app) {
    this.app = app
  }

  static get tableName() {
    return 'todo'
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
    }
  }

  static get relationMappings() {
    const User = require('./users.model')()

    return {
      user: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'todo.userId',
          to: 'user.id'
        }
      }
    }
  }

  static get modifiers() {
    const knex = this.app.get('knex')

    return {
      unDone: function(builder) {
        builder.where('complete', false)
      },
      overdue: builder => {
        builder
          .where('complete', false)
          .where('dueDate', '<', knex.fn.now())
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
    TodosModel.setup(app)

    const db = app.get('knex')

    // Clean up our data. This is optional and is here
    // because of our integration tests
    db.schema.dropTableIfExists('todo').then(function () {
      console.log('Dropped todo table')
    })

    db.schema
      .hasTable('todo')
      .then(exists => {
        if (!exists) {
          db.schema
            .createTable('todo', table => {
              table.increments('id')
              table.integer('userId')
              table.string('text', 500)
              table.boolean('complete')
              table.timestamp('dueDate')
              table.timestamp('createdAt')
              table.timestamp('updatedAt')
            })
            .then(() => console.log('Created todo table'))
            .catch(e => console.error('Error creating todo table', e))
        }
      })
      .catch(e => console.error('Error creating todo table', e))
  }

  return TodosModel
}
