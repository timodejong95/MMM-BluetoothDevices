'use strict';

const xml2js = require('xml2js');
const Eventable = require('./Eventable');
const Logger = require('./Logger');
const UnknownError = require('./errors/UnknownError');

class Device extends Eventable {
  /**
   * @param {object} options
   * @param {string} options.name
   * @param {string} options.mac
   * @param {number|null} options.servicesResolvedTimeout
   * @param {array|null} options.tracks
   * @param {Logger} logger
   */
  constructor(options, logger) {
    super();
    this.logger = logger;
    this.name = options.name;
    this.tracks = options.tracks || [];
    this.path = '';
    this.service = null;
    this.mac = options.mac;
    this.servicesResolvedTimeout = options.servicesResolvedTimeout || 15000;
    this.macPath = `dev_${options.mac.replace(/:/g, '_')}`;
    this.connected = false;
    this.servicesResolved = false;
    this.characteristicsByUUID = {};
    this.handlesByUUID = {};
    this.initialized = false;
    this.services = [];
    this.characteristics = [];
  }

  update(type, dev, props) {
    if (dev === this.macPath) {
      for (const key in props) {
        if (key === 'Connected') {
          this.connected = props[key];

          if (this.initialized) {
            this.logger.log(
              this.connected
                ? `connected to device: ${this.name}`
                : `connection lost with device: ${this.name}`,
            );
          }
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

  handleAdvertisingForDevice(props) {
    //
  }

  handleNotificationForDevice(props) {
    //
  }

  initialize(service, path, maxTries = 1) {
    this.path = `${path}/${this.macPath}`;
    this.service = service;

    return this.getDeviceInterface(this.path)
      .then((deviceInterface) => this.connect(deviceInterface, maxTries))
      .then(() => this.logger.log(`device: ${this.name} fully setup`))
      .catch((exception) => {
        this.logger.warn(`could not setup device: ${this.name}`);
        throw exception; // re-throw
      })
      .finally(() => {
        this.initialized = true;
      });
  }

  /**
   * @param {number} maxTries
   */
  connect(iFace, maxTries) {
    this.iFace = iFace;
    let tries = 0;

    const tryConnect = (exception = null) => new Promise((resolve, reject) => {
      if (tries < maxTries) {
        tries += 1;
        this.logger.log(`trying to connect to: ${this.name} ${tries}/${maxTries}`);

        connect()
          .then((response) => resolve(response))
          .catch((exception) => reject(exception));
      } else {
        reject(exception || new UnknownError({
          troubleshooting: 'devices#could-not-connect',
          exception: Error(`Couldn't connect to ${this.name} after ${tries} ${tries === 1 ? 'try' : 'tries'}.`),
          extra: {
            device: this,
          },
        }));
      }
    });

    const connect = () => new Promise((resolve, reject) => {
      iFace.Connect((exception) => {
        exception = Array.isArray(exception) ? exception.join('.') : exception;

        if (exception) {
          if (exception === 'Software caused connection abort') {
            tryConnect()
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
          this.logger.debug(`awaiting services for device: ${this.name}`);

          this.resolveServices(iFace)
            .then(() => this.logger.log(`connected to: ${this.name} after ${tries} ${tries === 1 ? 'try' : 'tries'}`))
            .then(() => resolve(iFace))
            .catch((e) => {
              tryConnect(e)
                .then((response) => resolve(response))
                .catch((v) => reject(v));
            });
        }
      });
    });

    return tryConnect()
      .then(() => this.mapServices())
      .then(() => this.watchCharacteristics());
  }

  resolveServices(deviceInterface) {
    return new Promise((resolve, reject) => {
      deviceInterface.ServicesResolved((exception, resolved) => {
        if (exception) {
          reject(new UnknownError({
            troubleshooting: 'devices#resolve-services',
            exception,
          }));
        } else if (resolved === false) {
          this.waitForServicesResolved()
            .then((response) => resolve(response))
            .catch((e) => reject(e));
        } else {
          this.servicesResolved = true;
          resolve();
        }
      });
    });
  }

  waitForServicesResolved() {
    const startTime = new Date().getTime();

    return new Promise(async (resolve, reject) => {
      this.logger.debug(`waiting for services to be resolved for: ${this.name}`);

      while (true) {
        if (this.servicesResolved === true) {
          return resolve(true);
        }

        if (new Date().getTime() > startTime + this.servicesResolvedTimeout) {
          return reject(new UnknownError({
            troubleshooting: 'devices#resolve-services',
            exception: new Error('waitForServicesResolved: timeout exceeded'),
          }));
        }

        await new Promise((r) => setTimeout(r, 100));
      }
    });
  }

  mapServices() {
    return new Promise(async (resolve, reject) => {
      if (this.services.length === 0) {
        return resolve();
      }

      let introspect;

      try {
        introspect = await this.getDeviceInterfaceIntrospect(this.path);
      } catch (exception) {
        return reject(exception);
      }

      const services = introspect.node.node.map((value) => value.$.name);
      const promises = [];

      for (const serviceName of services) {
        if (this.services.includes(serviceName)) {
          const servicePath = `${this.path}/${serviceName}`;
          promises.push(this.mapService(servicePath));
        }
      }

      Promise.all(promises)
        .then((response) => resolve(response))
        .catch((exception) => reject(exception));
    });
  }

  mapService(path) {
    return new Promise(async (resolve, reject) => {
      let introspect;
      try {
        introspect = await this.getDeviceInterfaceIntrospect(path);
      } catch (exception) {
        return reject(exception);
      }

      const characteristics = introspect.node.node.map((value) => value.$.name);
      const promises = [];

      for (const characteristicName of characteristics) {
        if (this.characteristics.includes(characteristicName)) {
          const characteristicsPath = `${path}/${characteristicName}`;
          promises.push(this.mapCharacteristic(characteristicsPath));
        }
      }

      Promise.all(promises)
        .then((response) => resolve(response))
        .catch((exception) => reject(exception));
    });
  }

  mapCharacteristic(path) {
    return new Promise(async (resolve, reject) => {
      let characteristicInterface;
      try {
        characteristicInterface = await this.getDeviceInterface(path, 'org.bluez.GattCharacteristic1');
      } catch (exception) {
        return reject(exception);
      }

      characteristicInterface.UUID((exception, uuid) => {
        if (exception) {
          reject(new UnknownError({
            troubleshooting: 'devices#service-characteristic-interface',
            exception,
            extra: {
              device: this,
            },
          }));
        } else {
          this.characteristicsByUUID[uuid] = characteristicInterface;
          this.handlesByUUID[uuid] = path;
          resolve();
        }
      });
    });
  }

  watchCharacteristics() {
    return new Promise((resolve, reject) => {
      resolve();
    });
  }

  getDeviceInterface(path, interfaceName = 'org.bluez.Device1') {
    return new Promise(((resolve, reject) => {
      this.service.getInterface(path, interfaceName, (exception, iFace) => {
        if (exception) {
          let troubleshooting = 'dongle#device-interface';

          if (interfaceName === 'org.freedesktop.DBus.Introspectable') {
            troubleshooting = 'devices#service-interface';
          } else if (interfaceName === 'org.bluez.GattCharacteristic1') {
            troubleshooting = 'devices#service-characteristic-interface';
          }

          reject(new UnknownError({
            troubleshooting,
            exception,
            extra: {
              interface: interfaceName,
              device: this,
            },
          }));
        } else {
          resolve(iFace);
        }
      });
    }));
  }

  getDeviceInterfaceIntrospect(path) {
    return this.getDeviceInterface(path, 'org.freedesktop.DBus.Introspectable')
      .then((deviceInterface) => new Promise((resolve, reject) => {
        deviceInterface.Introspect((exception, result) => {
          if (exception) {
            reject(new UnknownError({
              troubleshooting: 'devices#service-interface',
              exception,
            }));
          } else {
            const parser = new xml2js.Parser();
            parser.parseString(result, (e, result) => {
              if (e) {
                reject(e);
              } else {
                resolve(result);
              }
            });
          }
        });
      }));
  }

  destroy() {
    return new Promise((resolve, reject) => {
      this.getDeviceInterface(this.path)
        .then((deviceInterface) => new Promise((res, rej) => {
          deviceInterface.Disconnect(() => res());
        }))
        .then(() => resolve())
        .catch((exception) => reject(exception));
    }).then(() => this.emit('destroyed'));
  }
}

module.exports = Device;
