'use strict';

const UnknownError = require('../errors/UnknownError');

class CurrentTimeService {
  /**
   * @param {object} options
   * @param {string} options.hci
   * @param {string|null} options.serviceName
   */
  constructor(bus, service, options) {
    this.bus = bus;
    this.service = service;
    this.hci = options.hci;
    this.serviceName = options.serviceName || 'de.hypfer.mmm';
    this.serviceNameInDBusNotation = `/${this.serviceName.replace(/\./g, '/')}`;

    this.pathRoot = `/org/bluez/${this.hci}`;

    this.bus.exportInterface(
      {
        ReadValue: (value) => {
          const output = Buffer.alloc(10);
          const now = new Date();

          output.writeInt16LE(now.getFullYear());
          output.writeInt8(now.getMonth() + 1, 2);
          output.writeInt8(now.getDate(), 3);
          output.writeInt8(now.getHours(), 4);
          output.writeInt8(now.getMinutes(), 5);
          output.writeInt8(now.getSeconds(), 6);
          output.writeInt8(now.getDay(), 7);
          output.writeInt8(Math.floor(now.getMilliseconds() / 256), 8);

          if (Array.isArray(value) && Array.isArray(value[0]) && value[0][0] === 'device' && Array.isArray(value[0][1])) {
            //
          }

          return output;
        },
        Service: this.serviceNameInDBusNotation,
        UUID: '00002A2B-0000-1000-8000-00805f9b34fb',
        Flags: ['read'],
      },
      `${this.serviceNameInDBusNotation}/CURRENTTIME`,
      {
        name: 'org.bluez.GattCharacteristic1',
        methods: {
          ReadValue: ['', 'ay', [], ['arry{byte}']],
        },
        properties: {
          Service: 'o',
          UUID: 's',
          Flags: 'as',
        },
        signals: {},
      },
    );

    this.bus.exportInterface(
      {
        Primary: true,
        UUID: '00001805-0000-1000-8000-00805f9b34fb',
      },
      this.serviceNameInDBusNotation,
      {
        name: 'org.bluez.GattService1',
        methods: {},
        properties: {
          Primary: 'b',
          UUID: 's',
        },
        signals: {},
      },
    );

    this.bus.exportInterface(
      {
        GetManagedObjects: () => [ // This is a dict
          [this.serviceNameInDBusNotation, [['org.bluez.GattService1', [['UUID', ['s', '00001805-0000-1000-8000-00805f9b34fb']], ['Primary', ['b', true]]]]]],
          [
            `${this.serviceNameInDBusNotation}/CURRENTTIME`,
            [
              [
                'org.bluez.GattCharacteristic1',
                [
                  ['UUID', ['s', '00002A2B-0000-1000-8000-00805f9b34fb']],
                  ['Service', ['o', this.serviceNameInDBusNotation]],
                  ['Flags', ['as', ['read']]],
                ],
              ],
            ],
          ],
        ],
      },
      this.serviceNameInDBusNotation,
      {
        name: 'org.freedesktop.DBus.ObjectManager',
        methods: {
          GetManagedObjects: ['', 'a{oa{sa{sv}}}', [], ['dict_entry']],
        },
        properties: {},
        signals: {},
      },
    );
  }

  initialize() {
    return new Promise((resolve, reject) => {
      this.bus.requestName(this.serviceName, 0x4, (exception, retCode) => {
        exception = Array.isArray(exception) ? exception.join('.') : exception;

        if (exception) {
          reject(exception);
        } else if (retCode !== 1) {
          reject(new Error(`Failed with returnCode ${retCode}`));
        } else {
          this.service.getInterface(this.pathRoot, 'org.bluez.GattManager1', (error, gattMgrIface) => {
            error = Array.isArray(error) ? error.join('.') : error;

            if (error) {
              reject(new UnknownError({
                troubleshooting: 'services#invalid-adapter',
                exception: new Error(`Failed to fetch org.bluez.GattManager1 for hci: ${this.hci}`),
              }));
            } else {
              this.gattMgrIface = gattMgrIface;

              this.gattMgrIface.RegisterApplication(this.serviceNameInDBusNotation, [], (e) => {
                e = Array.isArray(e) ? e.join('.') : e;

                if (e) {
                  reject(new UnknownError({
                    troubleshooting: 'services',
                    exception: e,
                  }));
                } else {
                  resolve(true);
                }
              });
            }
          });
        }
      });
    });
  }

  destroy() {
    return new Promise((resolve, reject) => {
      this.gattMgrIface.UnregisterApplication(this.serviceNameInDBusNotation, (exception) => {
        exception = Array.isArray(exception) ? exception.join('.') : exception;

        if (exception) {
          reject(new UnknownError({
            troubleshooting: 'services#destroy',
            exception,
          }));
        } else {
          this.bus.releaseName(this.serviceName, resolve);
        }
      });
    });
  }
}

module.exports = CurrentTimeService;
