import { Model } from 'objection';
import path from 'path';

export default class Client extends Model {
  static tableName = 'clients'
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
          from: 'clients.companyId',
          to: 'companies.id'
        }
      }
    };
  }
}
