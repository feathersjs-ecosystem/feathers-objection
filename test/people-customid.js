import { Model } from 'objection'

export default class PeopleCustomid extends Model {
  static tableName = 'people-customid'

  static idColumn = 'customid'

  static jsonSchema = {
    type: 'object',
    required: ['name'],

    properties: {
      customid: { type: 'integer' },
      name: { type: 'string' },
      age: { type: ['integer', 'null'] },
      time: { type: ['integer', 'null'] },
      created: { type: ['boolean', 'null'] }
    }
  }
}
