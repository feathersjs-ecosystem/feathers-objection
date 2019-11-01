// TypeScript Version: 3.0
import { Params, Paginated, Id, NullableId } from '@feathersjs/feathers';
import { AdapterService, ServiceOptions, InternalServiceMethods } from '@feathersjs/adapter-commons';
import { Model } from 'objection';

export interface ObjectionServiceOptions extends ServiceOptions {
  model: typeof Model;
  idSeparator: string;
  jsonSchema: any;
  allowedEager: string | object;
  namedEagerFilters: any;
  eagerFilters: any;
  allowedInsert: string | object;
  insertGraphOptions: any;
  createUseUpsertGraph: any;
  allowedUpsert: string | object;
  upsertGraphOptions: any;
}

export class Service<T = any> extends AdapterService<T> implements InternalServiceMethods<T> {
  Model: typeof Model;
  options: ObjectionServiceOptions;

  constructor(config?: Partial<ObjectionServiceOptions>);

  _find(params?: Params): Promise<T | T[] | Paginated<T>>;
  _get(id: Id, params?: Params): Promise<T>;
  _create(data: Partial<T> | Array<Partial<T>>, params?: Params): Promise<T | T[]>;
  _update(id: NullableId, data: T, params?: Params): Promise<T>;
  _patch(id: NullableId, data: Partial<T>, params?: Params): Promise<T>;
  _remove(id: NullableId, params?: Params): Promise<T>;
}

declare const objection: ((config?: Partial<ObjectionServiceOptions>) => Service);
export default objection;
