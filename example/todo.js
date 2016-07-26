import { Model } from 'objection'

export default class Todo extends Model {
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
