import errors from '@feathersjs/errors';

const ERROR = Symbol('feathers-knex/error');

export default function errorHandler (error) {
  const { message } = error.nativeError || error;
  let feathersError = error;

  if (error.code === 'SQLITE_ERROR') {
    switch (error.errno) {
      case 1:
      case 8:
      case 18:
      case 19:
      case 20:
        feathersError = new errors.BadRequest(message);
        break;
      case 2:
        feathersError = new errors.Unavailable(message);
        break;
      case 3:
      case 23:
        feathersError = new errors.Forbidden(message);
        break;
      case 12:
        feathersError = new errors.NotFound(message);
        break;
      default:
        feathersError = new errors.GeneralError(message);
        break;
    }
  } else if (error.statusCode) { // Objection validation error
    switch (error.statusCode) {
      case 400:
        feathersError = new errors.BadRequest(message);
        break;

      case 401:
        feathersError = new errors.NotAuthenticated(message);
        break;

      case 402:
        feathersError = new errors.PaymentError(message);
        break;

      case 403:
        feathersError = new errors.Forbidden(message);
        break;

      case 404:
        feathersError = new errors.NotFound(message);
        break;

      case 405:
        feathersError = new errors.MethodNotAllowed(message);
        break;

      case 406:
        feathersError = new errors.NotAcceptable(message);
        break;

      case 408:
        feathersError = new errors.Timeout(message);
        break;

      case 409:
        feathersError = new errors.Conflict(message);
        break;

      case 422:
        feathersError = new errors.Unprocessable(message);
        break;

      case 501:
        feathersError = new errors.NotImplemented(message);
        break;

      case 503:
        feathersError = new errors.Unavailable(message);
        break;

      case 500:
      default:
        feathersError = new errors.GeneralError(message);
    }
  } else if (typeof error.code === 'string') { // Postgres error code - TODO: Properly detect postgres error
    const pgerror = error.code.substring(0, 2);

    switch (pgerror) {
      case '28':
      case '42':
        feathersError = new errors.Forbidden(message);
        break;

      case '20':
      case '21':
      case '22':
      case '23':
        feathersError = new errors.BadRequest(message);
        break;

      default:
        feathersError = new errors.GeneralError(message);
    }
  } else if (!(error instanceof errors.FeathersError)) {
    feathersError = new errors.GeneralError(message);
  }

  feathersError[ERROR] = error;

  throw feathersError;
}

errorHandler.ERROR = ERROR;
