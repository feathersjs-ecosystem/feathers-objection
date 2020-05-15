import { Model } from 'objection';
import service, { ERROR } from 'feathers-objection';

class Todo extends Model {
  static get tableName() {
    return 'todo';
  }
}

const myService = service({
  id: [ 'id', 'name' ],
  model: Todo
});

myService.Model.tableName;

typeof ERROR === 'symbol';
