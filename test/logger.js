'use strict';

const sinon = require('sinon');

class TestLogger {
  constructor() {
    this.log = sinon.stub();
    this.info = sinon.stub();
    this.debug = sinon.stub();
    this.warn = sinon.stub();
    this.error = sinon.stub();
  }
}

module.exports = TestLogger;
