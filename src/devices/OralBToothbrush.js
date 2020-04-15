'use strict';

const Device = require('../Device');

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
   * @param {array} props
   * @param {buffer} props.ManufacturerData
   */
  handleAdvertisingForDevice(props) {
    if (props.ManufacturerData) {
      const parsedData = this.parseData(props.ManufacturerData);

      this.emit('update', {
        status: parsedData.state > 0 ? 'online' : 'offline',
        state: STATES[parsedData.state],
        rssi: props.RSSI,
        pressure: parsedData.pressure,
        time: parsedData.time,
        mode: MODES[parsedData.mode],
        sector: SECTORS[parsedData.sector],
      });
    }
  }

  /**
   * @param {array} props
   */
  handleNotificationForDevice(props) {
    this.logger.log('handleNotificationForDevice', props);
  }

  /**
   * @param {buffer} data
   * @returns {{mode: string, state: string, pressure: string, time: string, sector: string}}
   */
  parseData(data) {
    return {
      state: data[3],
      pressure: data[4],
      time: data[5] * 60 + data[6],
      mode: data[7],
      sector: data[8],
    };
  }
}

module.exports = OralBToothbrush;
