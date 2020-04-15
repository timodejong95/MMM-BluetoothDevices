'use strict';

const OralBToothbrush = require('./OralBToothbrush');
const Logger = require('../Logger');

const devices = {
  OralBToothbrush,
};

/**
 * @param {object} options
 * @param {string} options.type
 * @param {Logger} logger
 */
module.exports.initialize = (options, logger) => {
  if (devices[options.type]) {
    return new devices[options.type](options, logger);
  }

  throw new Error(`Unknown device: ${options.type}`);
};
