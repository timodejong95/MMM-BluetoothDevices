'use strict';

const Device = require('../Device');
const Logger = require('../Logger');
const UnknownError = require('../errors/UnknownError');

const SECTORS = {
  1: 'sector_1',
  2: 'sector_2',
  3: 'sector_3',
  4: 'sector_4',
  5: 'sector_5',
  6: 'sector_6',
  7: 'sector_7',
  8: 'sector_8',
  15: 'unknown_1',
  31: 'unknown_2',
  23: 'unknown_3',
  47: 'unknown_4',
  55: 'unknown_5',
  254: 'last_sector',
  255: 'no_sector',
};

const STATES = {
  0: 'unknown',
  1: 'initializing',
  2: 'idle',
  3: 'running',
  4: 'charging',
  5: 'setup',
  6: 'flight_menu',
  113: 'final_test',
  114: 'pcb_test',
  115: 'sleeping',
  116: 'transport',
};

const MODES = {
  0: 'off',
  1: 'daily_clean',
  2: 'sensitive',
  3: 'massage',
  4: 'whitening',
  5: 'deep_clean',
  6: 'tongue_cleaning',
  7: 'turbo',
  255: 'unknown',
};

class OralBToothbrush extends Device {
  /**
   * @param {object} options
   * @param {string} options.name
   * @param {string} options.mac
   * @param {Logger} logger
   */
  constructor(options, logger) {
    super(options, logger);

    this.BATTERY_TRACK_KEY = 'battery';
    this.BATTERY_UUID = 'a0f0ff05-5047-4d53-8208-4f72616c2d42';
    this.BATTERY_SERVICE = 'service001e';
    this.BATTERY_CHARACTERISTIC = 'char002c';
    this.BATTERY_SERVICE_PATH = `${this.BATTERY_SERVICE}/${this.BATTERY_CHARACTERISTIC}`;

    if (this.tracks.includes(this.BATTERY_TRACK_KEY)) {
      this.services = [this.BATTERY_SERVICE];
      this.characteristics = [this.BATTERY_CHARACTERISTIC];
    }

    this.reconnecting = false;
    this.data = {
      status: null,
      state: null,
      rssi: null,
      pressure: null,
      time: null,
      mode: null,
      sector: null,
      battery: null,
    };
  }

  /**
   * @param {array} props
   * @param {buffer} props.ManufacturerData
   */
  handleAdvertisingForDevice(props) {
    if (props.ManufacturerData) {
      const data = props.ManufacturerData;

      this.data.status = data[3] > 0 ? 'online' : 'offline';
      this.data.state = STATES[data[3]];
      this.data.rssi = props.RSSI;
      this.data.pressure = data[4];
      this.data.time = data[5] * 60 + data[6];
      this.data.mode = MODES[data[7]];
      this.data.sector = SECTORS[data[8]];

      this.emit('update', this.data);

      if (this.shouldReconnect()) {
        this.reconnecting = true;
        this.logger.debug('reconnecting');

        this.connect(this.iFace, 1)
          .then(() => this.watchCharacteristics())
          .then(() => { this.reconnecting = false; })
          .catch(() => { this.reconnecting = false; });
      }
    }
  }

  shouldReconnect() {
    return this.tracks.includes(this.BATTERY_TRACK_KEY)
        && this.iFace
        && !this.connected // only if the devices is not connected
        && this.data.time < 10 // only at the beginning of the brush session
        && this.initialized
        && !this.reconnecting;
  }

  /**
   * @param {array} props
   */
  handleNotificationForDevice(props) {
    if (props.hasOwnProperty(this.BATTERY_SERVICE_PATH)) {
      this.data.battery = props[this.BATTERY_SERVICE_PATH][0];

      this.emit('update', this.data);
    }
  }

  watchCharacteristics() {
    return new Promise((resolve, reject) => {
      if (!this.tracks.includes(this.BATTERY_TRACK_KEY)) {
        return resolve();
      }

      if (this.characteristicsByUUID.hasOwnProperty(this.BATTERY_UUID)) {
        const characteristicsInterface = this.characteristicsByUUID[this.BATTERY_UUID];

        // Enable notifications
        characteristicsInterface.Notifying((err, notifying) => {
          if (notifying === false) {
            characteristicsInterface.StartNotify(() => {
              characteristicsInterface.ReadValue({}, (exception, value) => {
                if (exception) {
                  reject(new UnknownError({
                    troubleshooting: 'devices#characteristics',
                    exception: new Error(exception),
                    extra: {
                      device: this,
                    },
                  }));
                } else {
                  this.data.battery = value[0];
                  this.emit('update', this.data);
                  resolve();
                }
              });
            });
          } else {
            resolve();
          }
        });
      } else {
        reject(new UnknownError({
          troubleshooting: 'devices#characteristics',
          exception: new Error('battery characteristics not found'),
          extra: {
            device: this,
          },
        }));
      }
    });
  }

  destroy() {
    return new Promise((resolve, reject) => {
      if (this.characteristicsByUUID.hasOwnProperty(this.BATTERY_UUID)) {
        const characteristicsInterface = this.characteristicsByUUID[this.BATTERY_UUID];

        characteristicsInterface.Notifying((err, notifying) => {
          if (notifying === true) {
            characteristicsInterface.StopNotify((err) => {
              resolve();
            });
          } else {
            resolve();
          }
        });
      }
    }).then(() => super.destroy());
  }
}

module.exports = OralBToothbrush;
