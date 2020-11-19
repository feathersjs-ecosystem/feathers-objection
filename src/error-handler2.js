import errors from '@feathersjs/errors';
import {
  ValidationError,
  NotFoundError,
  DBError,
  ConstraintViolationError,
  UniqueViolationError,
  NotNullViolationError,
  ForeignKeyViolationError,
  CheckViolationError,
  DataError
} from 'objection';

const ERROR = Symbol('feathers-knex/error');

export default function errorHandler (error) {
  const { message } = error.nativeError || error;
  let feathersError;

  if (error instanceof errors.FeathersError) {
    feathersError = error;
  } else if (error instanceof ValidationError) {
    switch (error.type) {
      case 'ModelValidation':
        feathersError = new errors.BadRequest(message, error.data);
        break;
      case 'RelationExpression':
      case 'UnallowedRelation':
      case 'InvalidGraph':
        feathersError = new errors.BadRequest(message);
        break;
      default:
        feathersError = new errors.BadRequest(message);
    }
  } else if (error instanceof NotFoundError) {
    feathersError = new errors.NotFound(message);
  } else if (error instanceof UniqueViolationError) {
    feathersError = new errors.Conflict(message, {
      columns: error.columns,
      table: error.table,
      constraint: error.constraint
    });
  } else if (error instanceof ConstraintViolationError) {
    feathersError = new errors.Conflict(message, {
      columns: error.columns,
      table: error.table,
      constraint: error.constraint
    });
  } else if (error instanceof NotNullViolationError) {
    feathersError = new errors.BadRequest(message, {
      column: error.column,
      table: error.table
    });
  } else if (error instanceof ForeignKeyViolationError) {
    feathersError = new errors.Conflict(message, {
      table: error.table,
      constraint: error.constraint
    });
  } else if (error instanceof CheckViolationError) {
    feathersError = new errors.BadRequest(message, {
      table: error.table,
      constraint: error.constraint
    });
  } else if (error instanceof DataError) {
    feathersError = new errors.BadRequest(message);
  } else if (error instanceof DBError) {
    feathersError = new errors.GeneralError(message);
  } else {
    feathersError = new errors.GeneralError(message);
  }

  feathersError[ERROR] = error;

  throw feathersError;
}

errorHandler.ERROR = ERROR;
