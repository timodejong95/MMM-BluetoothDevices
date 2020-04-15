'use strict';

const devices = require('./devices');
const Eventable = require('./Eventable');
const Logger = require('./Logger');
const UnknownError = require('./errors/UnknownError');
const CurrentTimeService = require('./services/CurrentTimeService');

class Dongle extends Eventable {
  /**
   * @param {object} options
   * @param {Logger} logger
   */
  constructor(options, logger) {
    super();
    this.name = options.name;
    this.interfaceName = options.interfaceName;
    this.mode = options.mode;
    this.hci = options.hci;
    this.devices = options.devices.map((device) => {
      const d = devices.initialize(device, logger);

      d.on('update', (data) => {
        this.logger.log(`received device update for ${device.name}`);
        this.emit('deviceUpdate', { device, data });
      });

      return d;
    });
    this.rootPath = '/org/bluez/';
    this.path = `${this.rootPath}${options.hci}`;

    this.currentTimeService = null;
    this.logger = logger;
  }

  setup(bus, service) {
    bus.connection.on('message', (message) => this.handleMessage(message));

    return new Promise((resolve, reject) => {
      this.setupServices(bus, service)
        .then(() => this.getInterface(service))
        .then((adapter) => this.stopDiscovery(adapter))
        .then((adapter) => this.startDiscovery(adapter))
        .then(() => this.connectDevices(service))
        .then(() => this.emit('setupCompleted'))
        .then(() => resolve(this))
        .catch((exception) => reject(exception));
    });
  }

  async destroy() {
    const promises = [];
    for (const device in this.devices) {
      promises.push(device.destroy());
    }

    return Promise.all(promises)
      .then(() => this.currentTimeService.destroy());
  }

  setupServices(bus, service) {
    return new Promise((resolve, reject) => {
      this.currentTimeService = new CurrentTimeService(bus, service, { hci: this.hci });

      this.currentTimeService.initialize()
        .then(() => resolve())
        .catch((exception) => reject(exception));
    });
  }

  getInterface(service) {
    return new Promise((resolve, reject) => {
      service.getInterface(this.path, this.interfaceName, (exception, adapter) => {
        if (exception) {
          reject(new UnknownError({
            troubleshooting: 'dongle#interface',
            exception: Array.isArray(exception) ? exception.join('.') : exception,
          }));
        } else {
          resolve(adapter);
        }
      });
    });
  }

  stopDiscovery(adapter) {
    return new Promise((resolve, reject) => {
      adapter.StopDiscovery((exception) => {
        if (exception) {
          exception = Array.isArray(exception) ? exception.join('.') : exception;

          if (exception === 'No discovery started') {
            resolve(adapter);
          } else {
            reject(new UnknownError({
              troubleshooting: 'dongle#stop-discovery',
              exception,
            }));
          }
        } else {
          resolve(adapter);
        }
      });
    });
  }

  startDiscovery(adapter) {
    return new Promise((resolve, reject) => {
      adapter.SetDiscoveryFilter([['Transport', ['s', this.mode]]], (exception) => {
        if (exception) {
          reject(new UnknownError({
            troubleshooting: 'dongle#start-discovery-filter',
            exception,
          }));
        } else {
          adapter.StartDiscovery((err) => {
            if (err) {
              reject(new UnknownError({
                troubleshooting: 'dongle#start-discovery',
                exception: err,
              }));
            } else {
              resolve();
            }
          });
        }
      });
    });
  }

  handleMessage(message) {
    if (
      message && message.path && typeof message.path.indexOf === 'function'
      && message.path.indexOf(this.path) === 0
    ) {
      if (Array.isArray(message.body)) {
        if (message.body[0] === 'org.bluez.Device1') {
          let dev = message.path.split('/');
          dev = dev[dev.length - 1];

          const props = {};
          // TODO: Write a working parser for this mess of arrays
          if (Array.isArray(message.body[1])) {
            message.body[1].forEach((prop) => {
              if (Array.isArray(prop) && prop.length === 2 && Array.isArray(prop[1])) {
                const key = prop[0];
                let val = prop[1][1];

                if (Array.isArray(val)) {
                  if (key === 'ManufacturerData') {
                    try {
                      val = val[0][0][1][1][0];
                    } catch (e) {
                      this.logger.error('reject', e);
                    }
                  } else if (key === 'ServiceData') {
                    try {
                      val = {
                        UUID: val[0][0][0],
                        data: val[0][0][1][1][0],
                      };
                    } catch (e) {
                      this.logger.error('reject', e);
                    }
                  } else if (val.length === 1) {
                    val = val[0];
                  }
                }

                props[key] = val;
              }
            });
          } else {
            // TODO: better log
            this.logger.log('Unhandled Device msg:', message, JSON.stringify(message));
          }

          this.devices.map((device) => device.update(message.body[0], dev, props));
        } else if (message.body[0] === 'org.bluez.GattCharacteristic1') {
          const splitPath = message.path.split('/');
          const dev = splitPath[4];
          const characteristic = [splitPath[5], splitPath[6]].join('/');

          if (Array.isArray(message.body[1]) && Array.isArray(message.body[1][0]) && message.body[1][0][0] === 'Value') {
            const props = {};
            const value = message.body[1][0][1][1][0];

            props[characteristic] = value;

            this.devices.map((device) => device.update(message.body[0], dev, props));
          }
        } else if (message && Array.isArray(message.body) && message.body[0] === 'org.bluez.Adapter1') {
          if (JSON.stringify(message).includes('["Powered",[[{"type":"b","child":[]}],[false]]]')) {
            // yes, this is terrible, but I have absolutely no motivation to build a parser for this
            // shitty array of arrays format and there might be more propertys and a different order


            this.emit('death', message);
          } else {
            // TODO: log unhandled adapter message
          }
        } else {
          // TODO: better log
          this.logger.log('Unhandled other message:', message, JSON.stringify(message));
        }
      }
    }
  }

  async connectDevices(service) {
    const promises = [];

    for (const device of this.devices) {
      promises.push(this.connectDevice(service, device));
    }

    return Promise.all(promises);
  }

  /**
   * @param {number} maxTries
   */
  connectDevice(service, device, maxTries = 1) {
    return new Promise((resolve, reject) => {
      this.getDeviceInterface(service, device, 'org.bluez.Device1')
        .then((deviceInterface) => device.connect(deviceInterface, maxTries))
        .then((response) => resolve(response))
        .catch((exception) => reject(exception));
    });
  }

  /**
   * @param {object} device
   * @param {string} device.macPath
   */
  getDeviceInterface(service, device, ifaceName) {
    const path = `${this.path}/${device.macPath}`;

    return new Promise(((resolve, reject) => {
      service.getInterface(path, ifaceName, (exception, iFace) => {
        exception = Array.isArray(exception) ? exception.join('.') : exception;

        if (exception) {
          reject(new UnknownError({
            troubleshooting: 'dongle#device-interface',
            exception,
            extra: {
              device,
            },
          }));
        } else {
          resolve(iFace);
        }
      });
    }));
  }
}

module.exports = Dongle;
