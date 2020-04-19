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
   * @param {Logger} logger
   */
  constructor(options, logger) {
    super();
    this.logger = logger;
    this.name = options.name;
    this.tracks = options.tracks || [];
    this.path = '';
    this.mac = options.mac;
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

  initialize(service, path, maxTries = 1) {
    this.path = `${path}/${this.macPath}`;

    return this.getDeviceInterface(service, this.path)
      .then((deviceInterface) => this.connect(deviceInterface, maxTries))
      .then(() => this.mapServices(service))
      .then(() => this.watchCharacteristics())
      .then(() => this.logger.log(`device: ${this.name} fully setup`))
      .then(() => { this.initialized = true; });
  }

  /**
   * @param {number} maxTries
   */
  connect(iFace, maxTries) {
    this.iFace = iFace;
    let tries = 0;

    const tryConnect = () => new Promise((resolve, reject) => {
      if (tries < maxTries) {
        tries += 1;
        this.logger.log(`trying to connect to: ${this.name} ${tries}/${maxTries}`);

        connect()
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

    const connect = () => new Promise((resolve, reject) => {
      iFace.Connect((exception) => {
        exception = Array.isArray(exception) ? exception.join('.') : exception;

        if (exception) {
          if (exception === 'Software caused connection abort') {
            tryConnect()
              .then((response) => resolve(response))
              .catch((exception) => reject(exception));
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
            .then(() => {
              this.logger.log(`connected to: ${this.name} after ${tries} tries`);
              this.connected = true;
              this.emit('connected');
              resolve(iFace);
            })
            .catch((e) => reject(e));
        }
      });
    });

    return tryConnect();
  }

  resolveServices(deviceInterface) {
    return new Promise((resolve, reject) => {
      deviceInterface.ServicesResolved(async (exception, resolved) => {
        if (exception) {
          reject(new UnknownError({
            troubleshooting: 'devices#resolve-services',
            exception,
          }));
        } else if (resolved === false) {
          try {
            await this.waitForServicesResolved();
            resolve();
          } catch (e) {
            reject(e);
          }
        } else {
          this.servicesResolved = true;
          resolve();
        }
      });
    });
  }

  waitForServicesResolved() {
    const startTime = new Date().getTime();
    const timeout = 20000;

    return new Promise(async (resolve, reject) => {
      while (true) {
        if (this.servicesResolved === true) {
          resolve(true);
          return;
        }

        if (new Date().getTime() > startTime + timeout) {
          reject(new UnknownError({
            troubleshooting: 'devices#resolve-services',
            exception: new Error('waitForServicesResolved: timeout exceeded'),
          }));
          return;
        }

        await new Promise((r) => setTimeout(r, 100));
      }
    });
  }

  mapServices(service) {
    return new Promise(async (resolve, reject) => {
      const response = await this.getDeviceInterfaceIntrospect(service, this.path);
      const services = response.node.node.map((value) => value.$.name);
      const promises = [];

      for (const serviceName of services) {
        if (this.services.includes(serviceName)) {
          const servicePath = `${this.path}/${serviceName}`;
          promises.push(this.mapService(service, servicePath));
        }
      }

      Promise.all(promises)
        .then((response) => resolve(response))
        .catch((exception) => reject(exception));
    });
  }

  mapService(service, path) {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await this.getDeviceInterfaceIntrospect(service, path);
        const characteristics = response.node.node.map((value) => value.$.name);
        const promises = [];

        for (const characteristicName of characteristics) {
          if (this.characteristics.includes(characteristicName)) {
            const characteristicsPath = `${path}/${characteristicName}`;
            promises.push(this.mapCharacteristic(service, characteristicsPath));
          }
        }

        Promise.all(promises)
          .then((response) => resolve(response))
          .catch((exception) => reject(exception));
      } catch (exception) {
        reject(exception);
      }
    });
  }

  mapCharacteristic(service, path) {
    return new Promise(async (resolve, reject) => {
      try {
        const characteristicInterface = await this.getDeviceInterface(service, path, 'org.bluez.GattCharacteristic1');
        characteristicInterface.UUID((exception, uuid) => {
          if (exception) {
            reject(exception);
          } else {
            this.characteristicsByUUID[uuid] = characteristicInterface;
            this.handlesByUUID[uuid] = path;
            resolve();
          }
        });
      } catch (exception) {
        reject(exception);
      }
    });
  }

  getDeviceInterface(service, path, interfaceName = 'org.bluez.Device1') {
    return new Promise(((resolve, reject) => {
      service.getInterface(path, interfaceName, (exception, iFace) => {
        if (exception) {
          reject(new UnknownError({
            troubleshooting: 'dongle#device-interface',
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

  getDeviceInterfaceIntrospect(service, path) {
    return this.getDeviceInterface(service, path, 'org.freedesktop.DBus.Introspectable')
      .then((deviceInterface) => new Promise((resolve, reject) => {
        deviceInterface.Introspect((exception, result) => {
          if (exception) {
            reject(exception);
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

  destroy(service) {
    return new Promise((resolve, reject) => {
      this.getDeviceInterface(service, this.path)
        .then((deviceInterface) => new Promise((resolve, reject) => {
          deviceInterface.Disconnect(() => resolve());
        }))
        .then(() => resolve())
        .catch((exception) => reject(exception));
    }).then(() => this.emit('destroyed'));
  }
}

module.exports = Device;
