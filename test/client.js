import { Model } from 'objection'

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
        modelClass: require('./company'),
        join: {
          from: 'clients.companyId',
          to: 'companies.id'
        }
      }
    }
  }
}
