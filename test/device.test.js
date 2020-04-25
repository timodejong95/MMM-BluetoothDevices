'use strict';

const assert = require('assert');
const Device = require('../src/Device');
const TestLogger = require('./logger');
const UnknownError = require('../src/errors/UnknownError');

describe('Device', () => {
  describe('constructor', () => {
    it('Default values are set as expected', () => {
      const logger = new TestLogger('test', true);
      const fakeDevice = new Device({ name: 'test', mac: 'XX:XX:XX:XX:XX:XX', servicesResolvedTimeout: 1000 }, logger);

      assert.deepStrictEqual(fakeDevice.logger, logger);
      assert.strictEqual(fakeDevice.name, 'test');
      assert.deepEqual(fakeDevice.tracks, []);
      assert.strictEqual(fakeDevice.path, '');
      assert.strictEqual(fakeDevice.service, null);
      assert.strictEqual(fakeDevice.mac, 'XX:XX:XX:XX:XX:XX');
      assert.strictEqual(fakeDevice.macPath, 'dev_XX_XX_XX_XX_XX_XX');
      assert.deepEqual(fakeDevice.initialized, false);
      assert.strictEqual(fakeDevice.connected, false);
      assert.strictEqual(fakeDevice.servicesResolved, false);
      assert.deepEqual(fakeDevice.characteristicsByUUID, {});
      assert.deepEqual(fakeDevice.handlesByUUID, {});
      assert.deepEqual(fakeDevice.services, []);
      assert.deepEqual(fakeDevice.characteristics, []);
    });
  });

  describe('initialize', () => {
    it('If getDeviceInterface fails expect log', async () => {
      const getInterfaces = [];
      const service = {
        getInterface: (path, interfaceName, callback) => {
          getInterfaces.push([path, interfaceName]);
          callback('Unexpected test error', null);
        },
      };

      const logger = new TestLogger('test', true);
      const fakeDevice = new Device({ name: 'test', mac: 'XX:XX:XX:XX:XX:XX', servicesResolvedTimeout: 1000 }, logger);

      await assert.rejects(async () => {
        await fakeDevice.initialize(service, 'fake-path', 1);
      }, (exception) => {
        assert.ok(exception instanceof UnknownError);
        assert.equal(exception.message, 'Unexpected test error');
        assert.equal(exception.troubleshooting, 'dongle#device-interface');

        return true;
      });

      assert.deepEqual(getInterfaces, [
        ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.bluez.Device1'],
      ]);
      assert.ok(logger.log.notCalled);
      assert.ok(logger.warn.called);
      assert.deepEqual(logger.warn.args, [['could not setup device: test']]);
      assert.ok(fakeDevice.initialized);
    });

    describe('1 try', () => {
      it('If connecting fails with unhandleable exception expect handled exception', async () => {
        let connectCalled = 0;
        const getInterfaces = [];
        const deviceInterface = {
          Connect: (callback) => {
            connectCalled += 1;
            callback('Unexpected test error');
          },
        };
        const service = {
          getInterface: (path, interfaceName, callback) => {
            getInterfaces.push([path, interfaceName]);
            callback(null, deviceInterface);
          },
        };

        const logger = new TestLogger('test', true);
        const fakeDevice = new Device({
          name: 'test',
          mac: 'XX:XX:XX:XX:XX:XX',
          servicesResolvedTimeout: 1000,
        }, logger);

        await assert.rejects(async () => {
          await fakeDevice.initialize(service, 'fake-path', 1);
        }, (exception) => {
          assert.ok(exception instanceof UnknownError);
          assert.equal(exception.message, 'Unexpected test error');
          assert.equal(exception.troubleshooting, 'devices#connect-error');

          return true;
        });

        assert.deepEqual(getInterfaces, [
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.bluez.Device1'],
        ]);
        assert.equal(connectCalled, 1);
        assert.ok(logger.log.called);
        assert.deepEqual(logger.log.args, [['trying to connect to: test 1/1']]);
        assert.ok(logger.warn.called);
        assert.deepEqual(logger.warn.args, [['could not setup device: test']]);
        assert.ok(fakeDevice.initialized);
      });

      it('If connecting succeeded but resolving services fails instant expect handled exception', async () => {
        let connectCalled = 0;
        let servicesResolvedCalled = 0;
        const getInterfaces = [];
        const deviceInterface = {
          Connect: (callback) => {
            connectCalled += 1;
            callback(null);
          },
          ServicesResolved: (callback) => {
            servicesResolvedCalled += 1;
            callback('Unexpected test error', false);
          },
        };
        const service = {
          getInterface: (path, interfaceName, callback) => {
            getInterfaces.push([path, interfaceName]);
            callback(null, deviceInterface);
          },
        };

        const logger = new TestLogger('test', true);
        const fakeDevice = new Device({
          name: 'test',
          mac: 'XX:XX:XX:XX:XX:XX',
          servicesResolvedTimeout: 1000,
        }, logger);

        await assert.rejects(async () => {
          await fakeDevice.initialize(service, 'fake-path', 1);
        }, (exception) => {
          assert.ok(exception instanceof UnknownError);
          assert.equal(exception.message, 'Unexpected test error');
          assert.equal(exception.troubleshooting, 'devices#resolve-services');

          return true;
        });

        assert.deepEqual(getInterfaces, [
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.bluez.Device1'],
        ]);
        assert.equal(connectCalled, 1);
        assert.equal(servicesResolvedCalled, 1);
        assert.ok(logger.log.called);
        assert.deepEqual(logger.log.args, [['trying to connect to: test 1/1']]);
        assert.ok(logger.warn.called);
        assert.deepEqual(logger.warn.args, [['could not setup device: test']]);
        assert.ok(fakeDevice.initialized);
      });

      it('If connecting succeeded but resolving services timeouts expect handled exception', async () => {
        let connectCalled = 0;
        let servicesResolvedCalled = 0;
        const getInterfaces = [];
        const deviceInterface = {
          Connect: (callback) => {
            connectCalled += 1;
            callback(null);
          },
          ServicesResolved: (callback) => {
            servicesResolvedCalled += 1;
            callback(null, false);
          },
        };
        const service = {
          getInterface: (path, interfaceName, callback) => {
            getInterfaces.push([path, interfaceName]);
            callback(null, deviceInterface);
          },
        };

        const logger = new TestLogger('test', true);
        const fakeDevice = new Device({
          name: 'test',
          mac: 'XX:XX:XX:XX:XX:XX',
          servicesResolvedTimeout: 1000,
        }, logger);

        await assert.rejects(async () => {
          await fakeDevice.initialize(service, 'fake-path', 1);
        }, (exception) => {
          assert.ok(exception instanceof UnknownError);
          assert.equal(exception.message, 'Error: waitForServicesResolved: timeout exceeded');
          assert.equal(exception.troubleshooting, 'devices#resolve-services');

          return true;
        });

        assert.deepEqual(getInterfaces, [
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.bluez.Device1'],
        ]);
        assert.equal(connectCalled, 1);
        assert.equal(servicesResolvedCalled, 1);
        assert.ok(logger.log.called);
        assert.deepEqual(logger.log.args, [['trying to connect to: test 1/1']]);
        assert.ok(logger.warn.called);
        assert.deepEqual(logger.warn.args, [['could not setup device: test']]);
        assert.ok(fakeDevice.initialized);
      });

      it('If connecting succeeded but resolving services instant succeeds expect success', async () => {
        let connectCalled = 0;
        let servicesResolvedCalled = 0;
        const getInterfaces = [];
        const deviceInterface = {
          Connect: (callback) => {
            connectCalled += 1;
            callback(null);
          },
          ServicesResolved: (callback) => {
            servicesResolvedCalled += 1;
            callback(null, true);
          },
        };
        const service = {
          getInterface: (path, interfaceName, callback) => {
            getInterfaces.push([path, interfaceName]);
            callback(null, deviceInterface);
          },
        };

        const logger = new TestLogger('test', true);
        const fakeDevice = new Device({
          name: 'test',
          mac: 'XX:XX:XX:XX:XX:XX',
          servicesResolvedTimeout: 1000,
        }, logger);

        fakeDevice.servicesResolved = true;
        await fakeDevice.initialize(service, 'fake-path', 1);

        assert.deepEqual(getInterfaces, [
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.bluez.Device1'],
        ]);
        assert.equal(connectCalled, 1);
        assert.equal(servicesResolvedCalled, 1);
        assert.ok(logger.log.called);
        assert.deepEqual(logger.log.args, [
          ['trying to connect to: test 1/1'],
          ['connected to: test after 1 try'],
          ['device: test fully setup'],
        ]);
        assert.ok(logger.warn.notCalled);
        assert.ok(fakeDevice.initialized);
        assert.ok(fakeDevice.servicesResolved);
      });

      it('If connecting succeeded but resolving services interval succeeds expect success', async () => {
        let connectCalled = 0;
        let servicesResolvedCalled = 0;
        const getInterfaces = [];
        const deviceInterface = {
          Connect: (callback) => {
            connectCalled += 1;
            callback(null);
          },
          ServicesResolved: (callback) => {
            servicesResolvedCalled += 1;
            callback(null, false);
          },
        };
        const service = {
          getInterface: (path, interfaceName, callback) => {
            getInterfaces.push([path, interfaceName]);
            callback(null, deviceInterface);
          },
        };

        const logger = new TestLogger('test', true);
        const fakeDevice = new Device({
          name: 'test',
          mac: 'XX:XX:XX:XX:XX:XX',
          servicesResolvedTimeout: 1000,
        }, logger);

        fakeDevice.servicesResolved = true;
        await fakeDevice.initialize(service, 'fake-path', 1);

        assert.deepEqual(getInterfaces, [
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.bluez.Device1'],
        ]);
        assert.equal(connectCalled, 1);
        assert.equal(servicesResolvedCalled, 1);
        assert.ok(logger.log.called);
        assert.deepEqual(logger.log.args, [
          ['trying to connect to: test 1/1'],
          ['connected to: test after 1 try'],
          ['device: test fully setup'],
        ]);
        assert.ok(logger.warn.notCalled);
        assert.ok(fakeDevice.initialized);
      });
    });

    describe('2 tries', () => {
      it('If connecting fails with handleable exception retry which also fails expect handled exception', async () => {
        let connectCalled = 0;
        const getInterfaces = [];
        const deviceInterface = {
          Connect: (callback) => {
            connectCalled += 1;
            callback(['Software caused connection abort']);
          },
        };
        const service = {
          getInterface: (path, interfaceName, callback) => {
            getInterfaces.push([path, interfaceName]);
            callback(null, deviceInterface);
          },
        };

        const logger = new TestLogger('test', true);
        const fakeDevice = new Device({
          name: 'test',
          mac: 'XX:XX:XX:XX:XX:XX',
          servicesResolvedTimeout: 1000,
        }, logger);

        await assert.rejects(async () => {
          await fakeDevice.initialize(service, 'fake-path', 2);
        }, (exception) => {
          assert.ok(exception instanceof UnknownError);
          assert.equal(exception.message, 'Error: Couldn\'t connect to test after 2 tries.');
          assert.equal(exception.troubleshooting, 'devices#could-not-connect');

          return true;
        });

        assert.deepEqual(getInterfaces, [
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.bluez.Device1'],
        ]);
        assert.equal(connectCalled, 2);
        assert.ok(logger.log.called);
        assert.deepEqual(logger.log.args, [
          ['trying to connect to: test 1/2'],
          ['trying to connect to: test 2/2'],
        ]);
        assert.ok(logger.warn.called);
        assert.deepEqual(logger.warn.args, [['could not setup device: test']]);
        assert.ok(fakeDevice.initialized);
      });

      it('If connecting fails first try and timeout interval fails second try expect handled exception', async () => {
        let connectCalled = 0;
        let servicesResolvedCalled = 0;
        const getInterfaces = [];
        const deviceInterface = {
          Connect: (callback) => {
            connectCalled += 1;
            callback(connectCalled === 1 ? ['Software caused connection abort'] : null);
          },
          ServicesResolved: (callback) => {
            servicesResolvedCalled += 1;
            callback(null, false);
          },
        };
        const service = {
          getInterface: (path, interfaceName, callback) => {
            getInterfaces.push([path, interfaceName]);
            callback(null, deviceInterface);
          },
        };

        const logger = new TestLogger('test', true);
        const fakeDevice = new Device({
          name: 'test',
          mac: 'XX:XX:XX:XX:XX:XX',
          servicesResolvedTimeout: 1000,
        }, logger);

        await assert.rejects(async () => {
          await fakeDevice.initialize(service, 'fake-path', 2);
        }, (exception) => {
          assert.ok(exception instanceof UnknownError);
          assert.equal(exception.message, 'Error: waitForServicesResolved: timeout exceeded');
          assert.equal(exception.troubleshooting, 'devices#resolve-services');

          return true;
        });

        assert.deepEqual(getInterfaces, [
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.bluez.Device1'],
        ]);
        assert.equal(connectCalled, 2);
        assert.equal(servicesResolvedCalled, 1);
        assert.ok(logger.debug.called);
        assert.deepEqual(logger.debug.args, [
          ['awaiting services for device: test'],
          ['waiting for services to be resolved for: test'],
        ]);
        assert.ok(logger.log.called);
        assert.deepEqual(logger.log.args, [
          ['trying to connect to: test 1/2'],
          ['trying to connect to: test 2/2'],
        ]);
        assert.ok(logger.warn.called);
        assert.deepEqual(logger.warn.args, [['could not setup device: test']]);
        assert.ok(fakeDevice.initialized);
      });

      it('If connecting fails first try and timeout interval succeeds expect success', async () => {
        let connectCalled = 0;
        let servicesResolvedCalled = 0;
        const getInterfaces = [];
        const deviceInterface = {
          Connect: (callback) => {
            connectCalled += 1;
            callback(connectCalled === 1 ? ['Software caused connection abort'] : null);
          },
          ServicesResolved: (callback) => {
            servicesResolvedCalled += 1;
            callback(null, false);
          },
        };
        const service = {
          getInterface: (path, interfaceName, callback) => {
            getInterfaces.push([path, interfaceName]);
            callback(null, deviceInterface);
          },
        };

        const logger = new TestLogger('test', true);
        const fakeDevice = new Device({
          name: 'test',
          mac: 'XX:XX:XX:XX:XX:XX',
          servicesResolvedTimeout: 1000,
        }, logger);

        fakeDevice.servicesResolved = true;
        await fakeDevice.initialize(service, 'fake-path', 2);

        assert.deepEqual(getInterfaces, [
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.bluez.Device1'],
        ]);
        assert.equal(connectCalled, 2);
        assert.equal(servicesResolvedCalled, 1);
        assert.ok(logger.debug.called);
        assert.deepEqual(logger.debug.args, [
          ['awaiting services for device: test'],
          ['waiting for services to be resolved for: test'],
        ]);
        assert.ok(logger.log.called);
        assert.deepEqual(logger.log.args, [
          ['trying to connect to: test 1/2'],
          ['trying to connect to: test 2/2'],
          ['connected to: test after 2 tries'],
          ['device: test fully setup'],
        ]);
        assert.ok(logger.warn.notCalled);
        assert.ok(fakeDevice.initialized);
      });
    });

    describe('with services/characteristics', () => {
      it('If connecting succeeded but service interface not found expects handled exception', async () => {
        let connectCalled = 0;
        let servicesResolvedCalled = 0;
        const getInterfaces = [];
        const deviceInterface = {
          Connect: (callback) => {
            connectCalled += 1;
            callback(null);
          },
          ServicesResolved: (callback) => {
            servicesResolvedCalled += 1;
            callback(null, true);
          },
        };
        const service = {
          getInterface: (path, interfaceName, callback) => {
            getInterfaces.push([path, interfaceName]);

            if (interfaceName === 'org.freedesktop.DBus.Introspectable') {
              callback('Unexpected test error', null);
            } else {
              callback(null, deviceInterface);
            }
          },
        };

        const logger = new TestLogger('test', true);
        const fakeDevice = new Device({
          name: 'test',
          mac: 'XX:XX:XX:XX:XX:XX',
          servicesResolvedTimeout: 1000,
        }, logger);

        fakeDevice.services = ['fake-service'];
        await assert.rejects(async () => {
          await fakeDevice.initialize(service, 'fake-path', 1);
        }, (exception) => {
          assert.ok(exception instanceof UnknownError);
          assert.equal(exception.message, 'Unexpected test error');
          assert.equal(exception.troubleshooting, 'devices#service-interface');

          return true;
        });

        assert.deepEqual(getInterfaces, [
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.bluez.Device1'],
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.freedesktop.DBus.Introspectable'],
        ]);
        assert.equal(servicesResolvedCalled, 1);
        assert.equal(connectCalled, 1);
        assert.ok(logger.log.called);
        assert.deepEqual(logger.log.args, [
          ['trying to connect to: test 1/1'],
          ['connected to: test after 1 try'],
        ]);
        assert.ok(logger.warn.called);
        assert.deepEqual(logger.warn.args, [
          ['could not setup device: test'],
        ]);
        assert.ok(fakeDevice.initialized);
      });

      it('If connecting succeeded but service introspect fails expects handled exception', async () => {
        let connectCalled = 0;
        let servicesResolvedCalled = 0;
        const getInterfaces = [];
        const deviceInterface = {
          Connect: (callback) => {
            connectCalled += 1;
            callback(null);
          },
          ServicesResolved: (callback) => {
            servicesResolvedCalled += 1;
            callback(null, true);
          },
        };
        const deviceIntrospectInterface = {
          Introspect: (callback) => callback('Unexpected test error', null),
        };
        const service = {
          getInterface: (path, interfaceName, callback) => {
            getInterfaces.push([path, interfaceName]);
            callback(null, interfaceName === 'org.freedesktop.DBus.Introspectable' ? deviceIntrospectInterface : deviceInterface);
          },
        };

        const logger = new TestLogger('test', true);
        const fakeDevice = new Device({
          name: 'test',
          mac: 'XX:XX:XX:XX:XX:XX',
          servicesResolvedTimeout: 1000,
        }, logger);

        await assert.rejects(async () => {
          fakeDevice.services = ['fake-service'];
          await fakeDevice.initialize(service, 'fake-path', 1);
        }, (exception) => {
          assert.ok(exception instanceof UnknownError);
          assert.equal(exception.message, 'Unexpected test error');
          assert.equal(exception.troubleshooting, 'devices#service-interface');

          return true;
        });

        assert.deepEqual(getInterfaces, [
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.bluez.Device1'],
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.freedesktop.DBus.Introspectable'],
        ]);
        assert.equal(servicesResolvedCalled, 1);
        assert.equal(connectCalled, 1);
        assert.ok(logger.log.called);
        assert.deepEqual(logger.log.args, [
          ['trying to connect to: test 1/1'],
          ['connected to: test after 1 try'],
        ]);
        assert.ok(logger.warn.called);
        assert.deepEqual(logger.warn.args, [
          ['could not setup device: test'],
        ]);
        assert.ok(fakeDevice.initialized);
      });

      it('If service not found should expect success', async () => {
        let connectCalled = 0;
        let servicesResolvedCalled = 0;
        const getInterfaces = [];
        const deviceInterface = {
          Connect: (callback) => {
            connectCalled += 1;
            callback(null);
          },
          ServicesResolved: (callback) => {
            servicesResolvedCalled += 1;
            callback(null, true);
          },
        };
        const deviceIntrospectInterface = {
          Introspect: (callback) => callback(null, '<node><node name="fake-service-001"></node><node name="fake-service-002"></node></node>'),
        };
        const service = {
          getInterface: (path, interfaceName, callback) => {
            getInterfaces.push([path, interfaceName]);
            callback(null, interfaceName === 'org.freedesktop.DBus.Introspectable' ? deviceIntrospectInterface : deviceInterface);
          },
        };

        const logger = new TestLogger('test', true);
        const fakeDevice = new Device({
          name: 'test',
          mac: 'XX:XX:XX:XX:XX:XX',
          servicesResolvedTimeout: 1000,
        }, logger);


        fakeDevice.services = ['fake-service'];
        await fakeDevice.initialize(service, 'fake-path', 1);

        assert.deepEqual(getInterfaces, [
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.bluez.Device1'],
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.freedesktop.DBus.Introspectable'],
        ]);
        assert.equal(servicesResolvedCalled, 1);
        assert.equal(connectCalled, 1);
        assert.ok(logger.log.called);
        assert.deepEqual(logger.log.args, [
          ['trying to connect to: test 1/1'],
          ['connected to: test after 1 try'],
          ['device: test fully setup'],
        ]);
        assert.ok(logger.warn.notCalled);
        assert.ok(fakeDevice.initialized);
      });

      it('If service found but service interface not found should expect success', async () => {
        let connectCalled = 0;
        let servicesResolvedCalled = 0;
        const getInterfaces = [];
        const deviceInterface = {
          Connect: (callback) => {
            connectCalled += 1;
            callback(null);
          },
          ServicesResolved: (callback) => {
            servicesResolvedCalled += 1;
            callback(null, true);
          },
        };
        const deviceIntrospectInterface = {
          Introspect: (callback) => callback(null, '<node><node name="fake-service-001"></node><node name="fake-service-002"></node></node>'),
        };
        const service = {
          getInterface: (path, interfaceName, callback) => {
            getInterfaces.push([path, interfaceName]);
            if (path === 'fake-path/dev_XX_XX_XX_XX_XX_XX/fake-service-001') {
              callback('Unexpected test error', null);
            } else if (interfaceName === 'org.freedesktop.DBus.Introspectable') {
              callback(null, deviceIntrospectInterface);
            } else {
              callback(null, deviceInterface);
            }
          },
        };

        const logger = new TestLogger('test', true);
        const fakeDevice = new Device({
          name: 'test',
          mac: 'XX:XX:XX:XX:XX:XX',
          servicesResolvedTimeout: 1000,
        }, logger);

        await assert.rejects(async () => {
          fakeDevice.services = ['fake-service-001'];
          await fakeDevice.initialize(service, 'fake-path', 1);
        }, (exception) => {
          assert.ok(exception instanceof UnknownError);
          assert.equal(exception.message, 'Unexpected test error');
          assert.equal(exception.troubleshooting, 'devices#service-interface');

          return true;
        });

        assert.deepEqual(getInterfaces, [
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.bluez.Device1'],
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.freedesktop.DBus.Introspectable'],
          ['fake-path/dev_XX_XX_XX_XX_XX_XX/fake-service-001', 'org.freedesktop.DBus.Introspectable'],
        ]);
        assert.equal(servicesResolvedCalled, 1);
        assert.equal(connectCalled, 1);
        assert.ok(logger.log.called);
        assert.deepEqual(logger.log.args, [
          ['trying to connect to: test 1/1'],
          ['connected to: test after 1 try'],
        ]);
        assert.ok(logger.warn.called);
        assert.deepEqual(logger.warn.args, [
          ['could not setup device: test'],
        ]);
        assert.ok(fakeDevice.initialized);
      });

      it('If service and service interface found but introspects fails expects handled exception', async () => {
        let connectCalled = 0;
        let servicesResolvedCalled = 0;
        const getInterfaces = [];
        const deviceInterface = {
          Connect: (callback) => {
            connectCalled += 1;
            callback(null);
          },
          ServicesResolved: (callback) => {
            servicesResolvedCalled += 1;
            callback(null, true);
          },
        };
        const serviceIntrospectInterface = {
          Introspect: (callback) => callback('Unexpected test error', null),
        };
        const deviceIntrospectInterface = {
          Introspect: (callback) => callback(null, '<node><node name="fake-service-001"></node><node name="fake-service-002"></node></node>'),
        };
        const service = {
          getInterface: (path, interfaceName, callback) => {
            getInterfaces.push([path, interfaceName]);
            if (path === 'fake-path/dev_XX_XX_XX_XX_XX_XX/fake-service-001') {
              callback(null, serviceIntrospectInterface);
            } else if (interfaceName === 'org.freedesktop.DBus.Introspectable') {
              callback(null, deviceIntrospectInterface);
            } else {
              callback(null, deviceInterface);
            }
          },
        };

        const logger = new TestLogger('test', true);
        const fakeDevice = new Device({
          name: 'test',
          mac: 'XX:XX:XX:XX:XX:XX',
          servicesResolvedTimeout: 1000,
        }, logger);

        await assert.rejects(async () => {
          fakeDevice.services = ['fake-service-001'];
          await fakeDevice.initialize(service, 'fake-path', 1);
        }, (exception) => {
          assert.ok(exception instanceof UnknownError);
          assert.equal(exception.message, 'Unexpected test error');
          assert.equal(exception.troubleshooting, 'devices#service-interface');

          return true;
        });

        assert.deepEqual(getInterfaces, [
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.bluez.Device1'],
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.freedesktop.DBus.Introspectable'],
          ['fake-path/dev_XX_XX_XX_XX_XX_XX/fake-service-001', 'org.freedesktop.DBus.Introspectable'],
        ]);
        assert.equal(servicesResolvedCalled, 1);
        assert.equal(connectCalled, 1);
        assert.ok(logger.log.called);
        assert.deepEqual(logger.log.args, [
          ['trying to connect to: test 1/1'],
          ['connected to: test after 1 try'],
        ]);
        assert.ok(logger.warn.called);
        assert.deepEqual(logger.warn.args, [
          ['could not setup device: test'],
        ]);
        assert.ok(fakeDevice.initialized);
      });

      it('If service and service interface found but characteristic interface not found expects handled exception', async () => {
        let connectCalled = 0;
        let servicesResolvedCalled = 0;
        const getInterfaces = [];
        const deviceInterface = {
          Connect: (callback) => {
            connectCalled += 1;
            callback(null);
          },
          ServicesResolved: (callback) => {
            servicesResolvedCalled += 1;
            callback(null, true);
          },
        };
        const serviceIntrospectInterface = {
          Introspect: (callback) => callback(null, '<node><node name="fake-characteristic-001"></node><node name="fake-characteristic-002"></node></node>'),
        };
        const deviceIntrospectInterface = {
          Introspect: (callback) => callback(null, '<node><node name="fake-service-001"></node><node name="fake-service-002"></node></node>'),
        };
        const service = {
          getInterface: (path, interfaceName, callback) => {
            getInterfaces.push([path, interfaceName]);
            if (path === 'fake-path/dev_XX_XX_XX_XX_XX_XX/fake-service-001/fake-characteristic-001') {
              callback('Unexpected test error', null);
            } else if (path === 'fake-path/dev_XX_XX_XX_XX_XX_XX/fake-service-001') {
              callback(null, serviceIntrospectInterface);
            } else if (interfaceName === 'org.freedesktop.DBus.Introspectable') {
              callback(null, deviceIntrospectInterface);
            } else {
              callback(null, deviceInterface);
            }
          },
        };

        const logger = new TestLogger('test', true);
        const fakeDevice = new Device({
          name: 'test',
          mac: 'XX:XX:XX:XX:XX:XX',
          servicesResolvedTimeout: 1000,
        }, logger);

        await assert.rejects(async () => {
          fakeDevice.services = ['fake-service-001'];
          fakeDevice.characteristics = ['fake-characteristic-001'];
          await fakeDevice.initialize(service, 'fake-path', 1);
        }, (exception) => {
          assert.ok(exception instanceof UnknownError);
          assert.equal(exception.message, 'Unexpected test error');
          assert.equal(exception.troubleshooting, 'devices#service-characteristic-interface');

          return true;
        });

        assert.deepEqual(getInterfaces, [
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.bluez.Device1'],
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.freedesktop.DBus.Introspectable'],
          ['fake-path/dev_XX_XX_XX_XX_XX_XX/fake-service-001', 'org.freedesktop.DBus.Introspectable'],
          ['fake-path/dev_XX_XX_XX_XX_XX_XX/fake-service-001/fake-characteristic-001', 'org.bluez.GattCharacteristic1'],
        ]);
        assert.equal(servicesResolvedCalled, 1);
        assert.equal(connectCalled, 1);
        assert.ok(logger.log.called);
        assert.deepEqual(logger.log.args, [
          ['trying to connect to: test 1/1'],
          ['connected to: test after 1 try'],
        ]);
        assert.ok(logger.warn.called);
        assert.deepEqual(logger.warn.args, [
          ['could not setup device: test'],
        ]);
        assert.ok(fakeDevice.initialized);
      });

      it('If service, service interface, characteristic and characteristic interface found but error in UUID expects handled exception', async () => {
        let connectCalled = 0;
        let servicesResolvedCalled = 0;
        const getInterfaces = [];
        const deviceInterface = {
          Connect: (callback) => {
            connectCalled += 1;
            callback(null);
          },
          ServicesResolved: (callback) => {
            servicesResolvedCalled += 1;
            callback(null, true);
          },
        };
        const characteristicIntrospectInterface = {
          UUID: (callback) => callback('Unexpected test error', null),
        };
        const serviceIntrospectInterface = {
          Introspect: (callback) => callback(null, '<node><node name="fake-characteristic-001"></node><node name="fake-characteristic-002"></node></node>'),
        };
        const deviceIntrospectInterface = {
          Introspect: (callback) => callback(null, '<node><node name="fake-service-001"></node><node name="fake-service-002"></node></node>'),
        };
        const service = {
          getInterface: (path, interfaceName, callback) => {
            getInterfaces.push([path, interfaceName]);
            if (path === 'fake-path/dev_XX_XX_XX_XX_XX_XX/fake-service-001/fake-characteristic-001') {
              callback(null, characteristicIntrospectInterface);
            } else if (path === 'fake-path/dev_XX_XX_XX_XX_XX_XX/fake-service-001') {
              callback(null, serviceIntrospectInterface);
            } else if (interfaceName === 'org.freedesktop.DBus.Introspectable') {
              callback(null, deviceIntrospectInterface);
            } else {
              callback(null, deviceInterface);
            }
          },
        };

        const logger = new TestLogger('test', true);
        const fakeDevice = new Device({
          name: 'test',
          mac: 'XX:XX:XX:XX:XX:XX',
          servicesResolvedTimeout: 1000,
        }, logger);

        await assert.rejects(async () => {
          fakeDevice.services = ['fake-service-001'];
          fakeDevice.characteristics = ['fake-characteristic-001'];
          await fakeDevice.initialize(service, 'fake-path', 1);
        }, (exception) => {
          assert.ok(exception instanceof UnknownError);
          assert.equal(exception.message, 'Unexpected test error');
          assert.equal(exception.troubleshooting, 'devices#service-characteristic-interface');

          return true;
        });

        assert.deepEqual(getInterfaces, [
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.bluez.Device1'],
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.freedesktop.DBus.Introspectable'],
          ['fake-path/dev_XX_XX_XX_XX_XX_XX/fake-service-001', 'org.freedesktop.DBus.Introspectable'],
          ['fake-path/dev_XX_XX_XX_XX_XX_XX/fake-service-001/fake-characteristic-001', 'org.bluez.GattCharacteristic1'],
        ]);
        assert.equal(servicesResolvedCalled, 1);
        assert.equal(connectCalled, 1);
        assert.ok(logger.log.called);
        assert.deepEqual(logger.log.args, [
          ['trying to connect to: test 1/1'],
          ['connected to: test after 1 try'],
        ]);
        assert.ok(logger.warn.called);
        assert.deepEqual(logger.warn.args, [
          ['could not setup device: test'],
        ]);
        assert.ok(fakeDevice.initialized);
      });

      it('If service, service interface, characteristic and characteristic interface found and UUID response expects to succeed', async () => {
        let connectCalled = 0;
        let servicesResolvedCalled = 0;
        const getInterfaces = [];
        const deviceInterface = {
          Connect: (callback) => {
            connectCalled += 1;
            callback(null);
          },
          ServicesResolved: (callback) => {
            servicesResolvedCalled += 1;
            callback(null, true);
          },
        };
        const characteristicIntrospectInterface = {
          UUID: (callback) => callback('', '95cb18d6-6a3a-4b90-abb1-67883a4184ce'),
        };
        const serviceIntrospectInterface = {
          Introspect: (callback) => callback(null, '<node><node name="fake-characteristic-001"></node><node name="fake-characteristic-002"></node></node>'),
        };
        const deviceIntrospectInterface = {
          Introspect: (callback) => callback(null, '<node><node name="fake-service-001"></node><node name="fake-service-002"></node></node>'),
        };
        const service = {
          getInterface: (path, interfaceName, callback) => {
            getInterfaces.push([path, interfaceName]);
            if (path === 'fake-path/dev_XX_XX_XX_XX_XX_XX/fake-service-001/fake-characteristic-001') {
              callback(null, characteristicIntrospectInterface);
            } else if (path === 'fake-path/dev_XX_XX_XX_XX_XX_XX/fake-service-001') {
              callback(null, serviceIntrospectInterface);
            } else if (interfaceName === 'org.freedesktop.DBus.Introspectable') {
              callback(null, deviceIntrospectInterface);
            } else {
              callback(null, deviceInterface);
            }
          },
        };

        const logger = new TestLogger('test', true);
        const fakeDevice = new Device({
          name: 'test',
          mac: 'XX:XX:XX:XX:XX:XX',
          servicesResolvedTimeout: 1000,
        }, logger);

        fakeDevice.services = ['fake-service-001'];
        fakeDevice.characteristics = ['fake-characteristic-001'];
        await fakeDevice.initialize(service, 'fake-path', 1);

        assert.deepEqual(getInterfaces, [
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.bluez.Device1'],
          ['fake-path/dev_XX_XX_XX_XX_XX_XX', 'org.freedesktop.DBus.Introspectable'],
          ['fake-path/dev_XX_XX_XX_XX_XX_XX/fake-service-001', 'org.freedesktop.DBus.Introspectable'],
          ['fake-path/dev_XX_XX_XX_XX_XX_XX/fake-service-001/fake-characteristic-001', 'org.bluez.GattCharacteristic1'],
        ]);
        assert.equal(servicesResolvedCalled, 1);
        assert.equal(connectCalled, 1);
        assert.ok(logger.log.called);
        assert.deepEqual(logger.log.args, [
          ['trying to connect to: test 1/1'],
          ['connected to: test after 1 try'],
          ['device: test fully setup'],
        ]);
        assert.ok(logger.warn.notCalled);
        assert.ok(fakeDevice.initialized);
      });
    });
  });

  describe('update', () => {
    it('connected and servicesResolved are not updated if mac match', () => {
      const logger = new TestLogger('test', true);
      const fakeDevice = new Device({ name: 'test', mac: 'XX:XX:XX:XX:XX:XX', servicesResolvedTimeout: 1000 }, logger);

      assert.ok(fakeDevice.connected === false);
      assert.ok(fakeDevice.servicesResolved === false);

      fakeDevice.update('org.bluez.GattCharacteristic1', 'dev_01_02_03_04_05_06', {
        Connected: true,
        ServicesResolved: true,
      });

      assert.ok(fakeDevice.connected === false);
      assert.ok(fakeDevice.servicesResolved === false);
    });

    it('connected and servicesResolved are updated if mac match', () => {
      const logger = new TestLogger('test', true);
      const fakeDevice = new Device({ name: 'test', mac: 'XX:XX:XX:XX:XX:XX', servicesResolvedTimeout: 1000 }, logger);

      assert.ok(fakeDevice.connected === false);
      assert.ok(fakeDevice.servicesResolved === false);

      fakeDevice.update('org.bluez.GattCharacteristic1', 'dev_XX_XX_XX_XX_XX_XX', {
        Connected: true,
        ServicesResolved: true,
      });

      assert.ok(fakeDevice.connected);
      assert.ok(fakeDevice.servicesResolved);
    });
  });
});
