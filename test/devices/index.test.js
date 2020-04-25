'use strict';

const assert = require('assert');
const Device = require('../../src/Device');
const index = require('../../src/devices/index');

describe('Devices Index', () => {
  it('Invalid type throws exception', async () => {
    try {
      index.initialize({ type: 'invalid-type' });
    } catch (exception) {
      assert.strictEqual(exception.message, 'unknown device: invalid-type');
    }
  });

  it('Valid type returns device', async () => {
    const device = index.initialize({ type: 'OralBToothbrush', mac: 'XX:XX:XX:XX:XX:XX' }, {});

    assert.ok(device instanceof Device);
  });
});
