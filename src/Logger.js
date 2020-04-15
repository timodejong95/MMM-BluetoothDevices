'use strict';

class Logger {
  /**
   * @param {string} prefix
   */
  constructor(prefix) {
    this.prefix = prefix;
  }

  /**
   * @param {string} log
   */
  log(log) {
    console.log(`${this.prefix} ${log}`);
  }

  /**
   * @param {string} log
   */
  info(log) {
    console.info(`${this.prefix} ${log}`);
  }

  /**
   * @param {string} log
   */
  debug(log) {
    console.debug(`${this.prefix} ${log}`);
  }

  /**
   * @param {string} log
   */
  warn(log) {
    console.warn(`${this.prefix} ${log}`);
  }

  /**
   * @param {string} log
   */
  error(log) {
    console.error(`${this.prefix} ${log}`);
  }
}

module.exports = Logger;
