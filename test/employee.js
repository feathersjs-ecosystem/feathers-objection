import { Model } from 'objection';
import path from 'path';

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
        modelClass: path.join(__dirname, '/company'),
        join: {
          from: 'employees.companyId',
          to: 'companies.id'
        }
      }
    };
  }
}
