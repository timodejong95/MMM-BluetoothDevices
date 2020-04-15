'use strict';

class Eventable {
  constructor() {
    this.triggers = {};
  }

  /**
   * @param {string} event
   * @param {function} callback
   */
  on(event, callback) {
    if (!this.triggers[event]) {
      this.triggers[event] = [];
    }

    this.triggers[event].push(callback);
  }

  /**
   * @param {string} event
   * @param {*} params
   */
  emit(event, params = undefined) {
    if (this.triggers[event]) {
      for (const trigger of this.triggers[event]) {
        trigger(params);
      }
    }
  }
}

module.exports = Eventable;
