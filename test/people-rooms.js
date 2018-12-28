import { Model } from 'objection'

export default class PeopleRoom extends Model {
  static tableName = 'people-rooms'

  static jsonSchema = {
    type: 'object',
    required: ['admin'],

    properties: {
      peopleId: { type: 'integer' },
      roomId: { type: 'integer' },
      admin: { type: 'boolean' }
    }
  }
}
