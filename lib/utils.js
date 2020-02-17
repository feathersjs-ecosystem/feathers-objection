"use strict";

var _errors = _interopRequireDefault(require("@feathersjs/errors"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.isPlainObject = obj => {
  return obj && obj.constructor === {}.constructor;
};

exports.extractIds = (id, idKey, idSeparator) => {
  if (typeof id === 'object') {
    return idKey.map(idKey => id[idKey]);
  }

  if (id[0] === '[' && id[id.length - 1] === ']') {
    return JSON.parse(id);
  }

  if (id[0] === '{' && id[id.length - 1] === '}') {
    const obj = JSON.parse(id);
    return Object.keys(obj).map(key => obj[key]);
  }

  if (typeof id !== 'string' || !id.includes(idSeparator)) {
    throw new _errors.default.BadRequest('When using composite primary key, id must contain values for all primary keys');
  }

  return id.split(idSeparator);
};