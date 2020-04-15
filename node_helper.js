'use strict';

const NodeHelper = require('node_helper');
const hub = require('./src');

module.exports = NodeHelper.create({
  config: {},
  started: false,
  devices: {},
  dongle: null,

  start() {
    console.log(`Starting node helper for: ${this.name}`);
  },

  startHub(config) {
    if (this.started) {
      return;
    }

    this.started = true;

    console.log(`${this.name} starting hub`);

    this.config = config;
    this.dongle = hub.initialize(this.name, this.config);

    this.dongle.on('setupCompleted', () => {
      console.log(`${this.name} hub successfully started`);
    });

    this.dongle.on('deviceUpdate', ({ device, data }) => {
      this.devices[device.name] = { device, data };

      this.sendSocketNotification('FETCH_TOOTHBRUSHES_RESULTS', this.devices);
    });
  },

  async stop() {
    if (!this.started) {
      return;
    }

    console.log(`${this.name} stopping hub`);

    await this.dongle.destroy();

    console.log(`${this.name} hub stopped`);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === 'FETCH_TOOTHBRUSHES') {
      this.startHub(payload);

      this.sendSocketNotification('FETCH_TOOTHBRUSHES_RESULTS', this.devices);
    }
  },
});
