import { FeathersError, BadRequest, NotFound, Conflict, GeneralError } from '@feathersjs/errors';
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

  if (error instanceof FeathersError) {
    feathersError = error;
  } else if (error instanceof ValidationError) {
    switch (error.type) {
      case 'ModelValidation':
        feathersError = new BadRequest(message, error.data);
        break;
      case 'RelationExpression':
        feathersError = new BadRequest('Invalid Relation Expression');
        break;
      case 'UnallowedRelation':
        feathersError = new BadRequest('Unallowed Relation Expression');
        break;
      case 'InvalidGraph':
        feathersError = new BadRequest('Invalid Relation Graph');
        break;
      default:
        feathersError = new BadRequest('Unknown Validation Error');
    }
  } else if (error instanceof NotFoundError) {
    feathersError = new NotFound(message);
  } else if (error instanceof UniqueViolationError) {
    if (error.client === 'mysql') {
      feathersError = new Conflict(error.nativeError.sqlMessage, {
        constraint: error.constraint
      });
    } else {
      feathersError = new Conflict(`${error.columns.join(', ')} must be unique`, {
        columns: error.columns,
        table: error.table,
        constraint: error.constraint
      });
    }
  } else if (error instanceof NotNullViolationError) {
    feathersError = new BadRequest(`${error.column} must not be null`, {
      column: error.column,
      table: error.table
    });
  } else if (error instanceof ForeignKeyViolationError) {
    feathersError = new Conflict('Foreign Key Violation', {
      table: error.table,
      constraint: error.constraint
    });
  } else if (error instanceof CheckViolationError) {
    feathersError = new BadRequest('Check Violation', {
      table: error.table,
      constraint: error.constraint
    });
  } else if (error instanceof ConstraintViolationError) {
    feathersError = new Conflict('Constraint Violation', {
      columns: error.columns,
      table: error.table,
      constraint: error.constraint
    });
  } else if (error instanceof DataError) {
    feathersError = new BadRequest('Invalid Data');
  } else if (error instanceof DBError) {
    feathersError = new GeneralError('Unknown Database Error');
  } else {
    feathersError = new GeneralError(message);
  }

  feathersError[ERROR] = error;

  throw feathersError;
}

errorHandler.ERROR = ERROR;
