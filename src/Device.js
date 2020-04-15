'use strict';

const Eventable = require('./Eventable');
const Logger = require('./Logger');
const UnknownError = require('./errors/UnknownError');

class Device extends Eventable {
  /**
   * @param {object} options
   * @param {string} options.name
   * @param {string} options.mac
   * @param {Logger} logger
   */
  constructor(options, logger) {
    super();
    this.logger = logger;
    this.name = options.name;
    this.mac = options.mac;
    this.macPath = `dev_${options.mac.replace(/:/g, '_')}`;
    this.connected = false;
    this.servicesResolved = false;
  }

  update(type, dev, props) {
    if (dev === this.macPath) {
      for (const key in props) {
        if (key === 'Connected') {
          this.connected = props[key];
        } else if (key === 'ServicesResolved') {
          this.servicesResolved = props[key];
        }
      }

      if (type === 'org.bluez.Device1') {
        this.handleAdvertisingForDevice(props);
      } else if (type === 'org.bluez.GattCharacteristic1') {
        this.handleNotificationForDevice(props);
      }
    }
  }

  /**
   * @param {number} maxTries
   */
  connect(iFace, maxTries) {
    let tries = 1;

    const tryConnect = (_iFace, _maxTries) => {
      tries += 1;

      return new Promise((resolve, reject) => {
        if (tries <= _maxTries) {
          this.logger.log(`trying to connect to: ${this.name} ${tries}/${_maxTries}`);

          connect(_iFace, _maxTries)
            .then((response) => resolve(response))
            .catch((exception) => reject(exception));
        } else {
          reject(new UnknownError({
            troubleshooting: 'devices#could-not-connect',
            exception: Error(`Couldn't connect to ${this.name} after ${tries} tries.`),
            extra: {
              device: this,
            },
          }));
        }
      });
    };

    const connect = () => new Promise((resolve, reject) => {
      iFace.Connect(async (exception) => {
        exception = Array.isArray(exception) ? exception.join('.') : exception;

        if (exception) {
          if (exception === 'Software caused connection abort') {
            tryConnect(iFace, maxTries)
              .then((response) => resolve(response))
              .catch((e) => reject(e));
          } else {
            reject(new UnknownError({
              troubleshooting: 'devices#connect-error',
              exception,
              extra: {
                device: this,
              },
            }));
          }
        } else {
          this.logger.log(`connected to: ${this.name} after ${tries} tries`);
          this.connected = true;
          this.emit('connected');
          resolve(true);
        }
      });
    });

    this.logger.log(`trying to connect to: ${this.name} ${tries}/${maxTries}`);
    return connect();
  }

  destroy() {
    this.emit('destroyed');
  }
}

module.exports = Device;
