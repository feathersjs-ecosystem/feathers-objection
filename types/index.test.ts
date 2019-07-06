import { Model } from 'objection';
import service from 'feathers-objection';

class Todo extends Model {
  static get tableName() {
    return 'todo';
  }
}

const myService = service({
  Model: Todo
});
