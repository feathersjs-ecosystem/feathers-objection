import { Model } from 'objection'

export default class PeopleRoomsCustomIdSeparator extends Model {
  static tableName = 'people-rooms-custom-id-separator'

  static jsonSchema = {
    type: 'object',
    required: ['admin'],

    properties: {
      peopleId: {type: 'integer'},
      roomId: {type: 'integer'},
      admin: {type: 'boolean'}
    }
  }
}
