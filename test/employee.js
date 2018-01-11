import { Model } from 'objection'

export default class Employee extends Model {
  static tableName = 'employees'
  static jsonSchema = {
    type: 'object',
    required: ['name'],

    properties: {
      id: { type: 'integer' },
      companyId: { type: 'integer' },
      name: { type: 'string' }
    }
  }

  static get relationMappings () {
    return {
      company: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./company'),
        join: {
          from: 'employees.companyId',
          to: 'companies.id'
        }
      }
    }
  }
}
