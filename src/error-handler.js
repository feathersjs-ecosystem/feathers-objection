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
        feathersError = new errors.BadRequest('Invalid Relation Expression');
        break;
      case 'UnallowedRelation':
        feathersError = new errors.BadRequest('Unallowed Relation Expression');
        break;
      case 'InvalidGraph':
        feathersError = new errors.BadRequest('Invalid Relation Graph');
        break;
      default:
        feathersError = new errors.BadRequest('Unknown Validation Error');
    }
  } else if (error instanceof NotFoundError) {
    feathersError = new errors.NotFound(message);
  } else if (error instanceof UniqueViolationError) {
    if (error.client === 'mysql') {
      feathersError = new errors.Conflict(error.nativeError.sqlMessage, {
        constraint: error.constraint
      });
    } else {
      feathersError = new errors.Conflict(`${error.columns.join(', ')} must be unique`, {
        columns: error.columns,
        table: error.table,
        constraint: error.constraint
      });
    }
  } else if (error instanceof NotNullViolationError) {
    feathersError = new errors.BadRequest(`${error.column} must not be null`, {
      column: error.column,
      table: error.table
    });
  } else if (error instanceof ForeignKeyViolationError) {
    feathersError = new errors.Conflict('Foreign Key Violation', {
      table: error.table,
      constraint: error.constraint
    });
  } else if (error instanceof CheckViolationError) {
    feathersError = new errors.BadRequest('Check Violation', {
      table: error.table,
      constraint: error.constraint
    });
  } else if (error instanceof ConstraintViolationError) {
    feathersError = new errors.Conflict('Constraint Violation', {
      columns: error.columns,
      table: error.table,
      constraint: error.constraint
    });
  } else if (error instanceof DataError) {
    feathersError = new errors.BadRequest('Invalid Data');
  } else if (error instanceof DBError) {
    feathersError = new errors.GeneralError('Unknown Database Error');
  } else {
    feathersError = new errors.GeneralError(message);
  }

  feathersError[ERROR] = error;

  throw feathersError;
}

errorHandler.ERROR = ERROR;
