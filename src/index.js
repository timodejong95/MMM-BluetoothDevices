'use strict';

const dbus = require('dbus-native');
const Dongle = require('./Dongle');
const Logger = require('./Logger');

const bus = dbus.systemBus();
const service = bus.getService('org.bluez');

bus.addMatch("type='signal'");

/**
 * @param {string} moduleName
 * @param {object} config
 * @returns {Dongle}
 */
module.exports.initialize = (moduleName, config) => {
  const logger = new Logger(moduleName);
  const dongle = new Dongle(config, logger);

  dongle.setup(bus, service)
    .catch((exception) => {
      logger.error('unhandled exception:');
      throw exception;
    });

  return dongle;
};
