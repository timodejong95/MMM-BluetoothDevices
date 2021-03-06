'use strict';

const dbus = require('dbus-native');
const safeStringify = require('fast-safe-stringify');
const Dongle = require('./Dongle');
const Logger = require('./Logger');

const bus = dbus.systemBus();
const service = bus.getService('org.bluez');

/**
 * @param {string} moduleName
 * @param {object} config
 * @param {boolean} config.debugLogs
 * @returns {Dongle}
 */
module.exports.initialize = (moduleName, config) => {
  const logger = new Logger(moduleName, config.debugLogs || false);
  const dongle = new Dongle(config, logger);

  dongle.setup(bus, service)
    .catch((exception) => {
      logger.error('unhandled exception:');
      logger.error(exception);
      logger.error(safeStringify(exception));
    });

  return dongle;
};
