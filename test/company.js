import { Model } from 'objection'
import path from 'path'

export default class Company extends Model {
  static tableName = 'companies'

  static jsonSchema = {
    type: 'object',
    required: ['name'],

    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      ceo: { type: ['integer', 'null'] },
      jsonObject: {
        type: ['object', 'null'],
        properties: {
          numberField: { type: 'number' },
          objectField: {
            type: 'object',
            properties: {
              object: { type: 'string' }
            }
          }
        }
      },
      jsonArray: { type: ['array', 'null'] }
    }
  }

  // This object defines the relations to other models.
  static relationMappings = {
    ceos: {
      relation: Model.BelongsToOneRelation,
      modelClass: path.join(__dirname, '/people'),
      join: {
        from: 'companies.ceo',
        to: 'people.id'
      }
    },
    employees: {
      relation: Model.HasManyRelation,
      modelClass: path.join(__dirname, '/employee'),
      join: {
        from: 'companies.id',
        to: 'employees.companyId'
      }
    },
    clients: {
      relation: Model.HasManyRelation,
      modelClass: path.join(__dirname, '/client'),
      join: {
        from: 'companies.id',
        to: 'clients.companyId'
      }
    }
  }
}
