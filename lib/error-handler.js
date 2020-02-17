"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = errorHandler;

var _errors = _interopRequireDefault(require("@feathersjs/errors"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const ERROR = Symbol('feathers-knex/error');

function errorHandler(error) {
  const {
    message
  } = error.nativeError || error;
  let feathersError = error;

  if (error.code === 'SQLITE_ERROR') {
    switch (error.errno) {
      case 1:
      case 8:
      case 18:
      case 19:
      case 20:
        feathersError = new _errors.default.BadRequest(message);
        break;

      case 2:
        feathersError = new _errors.default.Unavailable(message);
        break;

      case 3:
      case 23:
        feathersError = new _errors.default.Forbidden(message);
        break;

      case 12:
        feathersError = new _errors.default.NotFound(message);
        break;

      default:
        feathersError = new _errors.default.GeneralError(message);
        break;
    }
  } else if (error.statusCode) {
    // Objection validation error
    switch (error.statusCode) {
      case 400:
        feathersError = new _errors.default.BadRequest(message);
        break;

      case 401:
        feathersError = new _errors.default.NotAuthenticated(message);
        break;

      case 402:
        feathersError = new _errors.default.PaymentError(message);
        break;

      case 403:
        feathersError = new _errors.default.Forbidden(message);
        break;

      case 404:
        feathersError = new _errors.default.NotFound(message);
        break;

      case 405:
        feathersError = new _errors.default.MethodNotAllowed(message);
        break;

      case 406:
        feathersError = new _errors.default.NotAcceptable(message);
        break;

      case 408:
        feathersError = new _errors.default.Timeout(message);
        break;

      case 409:
        feathersError = new _errors.default.Conflict(message);
        break;

      case 422:
        feathersError = new _errors.default.Unprocessable(message);
        break;

      case 501:
        feathersError = new _errors.default.NotImplemented(message);
        break;

      case 503:
        feathersError = new _errors.default.Unavailable(message);
        break;

      case 500:
      default:
        feathersError = new _errors.default.GeneralError(message);
    }
  } else if (typeof error.code === 'string') {
    // Postgres error code - TODO: Properly detect postgres error
    const pgerror = error.code.substring(0, 2);

    switch (pgerror) {
      case '28':
      case '42':
        feathersError = new _errors.default.Forbidden(message);
        break;

      case '20':
      case '21':
      case '22':
      case '23':
        feathersError = new _errors.default.BadRequest(message);
        break;

      default:
        feathersError = new _errors.default.GeneralError(message);
    }
  } else if (!(error instanceof _errors.default.FeathersError)) {
    feathersError = new _errors.default.GeneralError(message);
  }

  feathersError[ERROR] = error;
  throw feathersError;
}

errorHandler.ERROR = ERROR;
module.exports = exports.default;