// See https://vincit.github.io/objection.js/#models
// for more of what you can do here.
import { Model } from 'objection'

class Todo extends Model {
  static tableName = 'todos'

  static jsonSchema = {
    type: 'object',
    required: ['text'],

    properties: {
      id: { type: 'integer' },
      text: { type: 'string' },
      complete: { type: 'boolean', default: false }
    },
    options: {
      timestamps: true
    }
  }

  $beforeInsert () {
    this.createdAt = this.updatedAt = new Date().toISOString()
  }

  $beforeUpdate () {
    this.updatedAt = new Date().toISOString()
  }
}

module.exports = function (app) {
  const db = app.get('knex')

  // Clean up our data. This is optional and is here
  // because of our integration tests
  db.schema.dropTableIfExists('todos').then(function () {
    console.log('Dropped todos table')

    // Initialize your table
    return db.schema.createTable('todos', function (table) {
      console.log('Creating todos table')
      table.increments('id')
      table.string('text')
      table.boolean('complete')
      table.timestamp('createdAt')
      table.timestamp('updatedAt')
    })
      .then(() => console.log('Created todos table'))
      .catch(e => console.error('Error creating todos table', e))
  })
    .catch(e => console.error('Error creating todos table', e))

  return Todo
}
