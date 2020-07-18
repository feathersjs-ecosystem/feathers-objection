import { Model } from 'objection';
import path from 'path';

export default class Company extends Model {
  static tableName = 'companies'

  static jsonSchema = {
    type: 'object',
    required: ['name'],

    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      ceo: { type: ['integer', 'null'] },
      size: { type: ['string', 'null'], enum: ['small', 'medium', 'large', null] },
      jsonObject: {
        type: ['object', 'null'],
        properties: {
          stringField: { type: 'string' },
          numberField: { type: 'number' },
          objectField: {
            type: 'object',
            properties: {
              object: { type: 'string' }
            }
          },
          'first.founder': { type: ['string', 'null'] }
        }
      },
      jsonArray: { type: ['array', 'null'] },
      jsonbObject: { type: ['object', 'null'] },
      jsonbArray: { type: ['array', 'null'] }
    }
  }

  static modifiers = {
    orderByName: builder => {
      builder.orderBy('name');
    },
    google: (builder, hasCeo) => {
      builder.where('companies.name', 'Google')
        .select(['companies.name'])
        .groupBy(['companies.name']);

      if (hasCeo) { builder.whereNot('ceo', null); }
    },
    googleWithEager: (builder, hasCeo) => {
      builder.where('companies.name', 'Google')
        .select(['companies.name'])
        .groupBy(['companies.name', 'companies.id']);

      if (hasCeo) { builder.whereNot('ceo', null); }
    },
    apple: (builder, hasCeo) => {
      builder.where('name', 'Apple');

      if (hasCeo) { builder.whereNot('ceo', null); }
    },
    large: (builder, hasCeo) => {
      builder.where('size', 'large');

      if (hasCeo) { builder.whereNot('ceo', null); }
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

  $beforeInsert () {
    if (this.id) { this.id = 99; }
  }
}
