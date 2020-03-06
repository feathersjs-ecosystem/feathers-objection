import { Model } from 'objection';
import path from 'path';

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

  static modifiers = {
    notSnoop: builder => {
      builder.whereNot('name', 'Snoop');
    }
  }

  static relationMappings = {
    company: {
      relation: Model.BelongsToOneRelation,
      modelClass: path.join(__dirname, '/company'),
      join: {
        from: 'people.id',
        to: 'companies.ceo'
      }
    }
  }
}
