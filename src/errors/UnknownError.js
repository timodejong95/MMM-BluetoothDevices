'use strict';

class UnknownError extends Error {
  /**
   * @param {object} object
   * @param {Error} object.exception
   * @param {string} object.troubleshooting
   * @param {object} object.extra
   */
  constructor(object) {
    super(object.exception);
    this.troubleshooting = object.troubleshooting;
    this.extra = object.extra || {};
  }
}

module.exports = UnknownError;
