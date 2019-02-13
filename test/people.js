import { Model } from 'objection';

export default class People extends Model {
  static tableName = 'people'

  static jsonSchema = {
    type: 'object',
    required: ['name'],

    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      age: { type: ['integer', 'null'] },
      time: { type: ['integer', 'null'] },
      created: { type: ['boolean', 'null'] }
    }
  }
}
