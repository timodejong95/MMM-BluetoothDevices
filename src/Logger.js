'use strict';

class Logger {
  /**
   * @param {string} prefix
   * @param {boolean} debugLogs
   */
  constructor(prefix, debugLogs) {
    this.prefix = prefix;
    this.debugLogs = debugLogs;
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
    if (this.debugLogs) {
      console.log(`${this.prefix} ${log}`);
    }
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
