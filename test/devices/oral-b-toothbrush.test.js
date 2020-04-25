'use strict';

const assert = require('assert');
const OralBToothbrush = require('../../src/devices/OralBToothbrush');

describe('OralBToothBrush', () => {
  describe('handleAdvertisingForDevice', () => {
    it('should parse data and fire update', () => {
      const device = new OralBToothbrush({ type: 'OralBToothbrush', mac: 'XX:XX:XX:XX:XX:XX' });
      device.handleAdvertisingForDevice({
        RSSI: 10,
        ManufacturerData: [0, 0, 0, 3, 20, 1, 10, 1, 8],
      });

      assert.strictEqual(device.data.status, 'online');
      assert.strictEqual(device.data.state, 'running');
      assert.strictEqual(device.data.rssi, 10);
      assert.strictEqual(device.data.pressure, 20);
      assert.strictEqual(device.data.time, 70);
      assert.strictEqual(device.data.mode, 'daily_clean');
      assert.strictEqual(device.data.sector, 'sector_8');
      assert.strictEqual(device.data.battery, null);
    });
  });
});
