import errors from '@feathersjs/errors'

export default function errorHandler (error) {
  let feathersError = error

  if (error.code === 'SQLITE_ERROR') {
    switch (error.errno) {
      case 1:
      case 8:
      case 18:
      case 19:
      case 20:
        feathersError = new errors.BadRequest(error)
        break
      case 2:
        feathersError = new errors.Unavailable(error)
        break
      case 3:
      case 23:
        feathersError = new errors.Forbidden(error)
        break
      case 12:
        feathersError = new errors.NotFound(error)
        break
      default:
        feathersError = new errors.GeneralError(error)
        break
    }

    throw feathersError
  }

  // Objection validation error
  if (error.statusCode) {
    switch (error.statusCode) {
      case 400:
        feathersError = new errors.BadRequest(error.data)
        break

      case 401:
        feathersError = new errors.NotAuthenticated(error.data)
        break

      case 402:
        feathersError = new errors.PaymentError(error.data)
        break

      case 403:
        feathersError = new errors.Forbidden(error.data)
        break

      case 404:
        feathersError = new errors.NotFound(error.data)
        break

      case 405:
        feathersError = new errors.MethodNotAllowed(error.data)
        break

      case 406:
        feathersError = new errors.NotAcceptable(error.data)
        break

      case 408:
        feathersError = new errors.Timeout(error.data)
        break

      case 409:
        feathersError = new errors.Conflict(error.data)
        break

      case 422:
        feathersError = new errors.Unprocessable(error.data)
        break

      case 500:
        feathersError = new errors.GeneralError(error.data)
        break

      case 501:
        feathersError = new errors.NotImplemented(error.data)
        break

      case 503:
        feathersError = new errors.Unavailable(error.data)
        break

      default:
        feathersError = new errors.GeneralError(error)
    }

    throw feathersError
  }

  // Postgres error code
  // TODO
  // Properly detect postgres error
  if (typeof error.code === 'string') {
    const pgerror = error.code.substring(0, 2)

    switch (pgerror) {
      case '28':
        feathersError = new errors.Forbidden(error)
        break

      case '20':
      case '21':
      case '22':
      case '23':
        feathersError = new errors.BadRequest(error)
        break

      case '42':
        feathersError = new errors.Forbidden(error)
        break

      default:
        feathersError = new errors.GeneralError(error)
    }

    throw feathersError
  }

  throw feathersError
}
