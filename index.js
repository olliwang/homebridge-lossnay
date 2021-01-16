const i2c = require('i2c-bus')
const i2c1 = i2c.openSync(1)

var Service, Characteristic;

module.exports = function(homebridge) {
  Characteristic = homebridge.hap.Characteristic;
  Service = homebridge.hap.Service;

  homebridge.registerAccessory("homebridge-lossnay",
                               "Lossnay",
                               Lossnay);
}

function Lossnay(log, config) {
  function boolValueWithDefault(value, defaultValue) {
    if (value == undefined) {
      return defaultValue;
    } else {
      return value;
    }
  }

  this.debug = boolValueWithDefault(config.debug, false);
  this.name = config.name || 'Lossnay';
  this.displayName = config.name;
  this.maxVoltage = config.maxVoltage || 5.0;
  this.initialFanSpeed = 1;
  this.voltageOffset = config.voltageOffset || 0.0;

  this.services = [];

  this.fanSpeed = this.initialFanSpeed;
  this.setFanSpeed(this.fanSpeed);
}

Lossnay.prototype = {
  setFanSpeed: function(speed) {
    this.fanSpeed = speed;
    console.log('[Lossnay] - Set Fan Speed: ' + speed);
    const DEVICE_ADDRESS = 0x62
    const CMD_WRITEDAC = 0x40
    const CMD_WRITEDACEEPROM = 0x60

    var value = 0;
    if (speed > 0) {
      var voltage = this.maxVoltage / 4 * speed + this.voltageOffset;
      console.log('[Lossnay] - Set Voltage: ' + voltage);
      value = Math.round(voltage / this.maxVoltage * 4095);
      if (value > 4095) {
        value = 4095
      }
    }

    new Promise((resolve, reject) => {
      i2c1.writeI2cBlock(
          DEVICE_ADDRESS, CMD_WRITEDAC, 2,
          Buffer.from([(value >> 4) & 0xFF, (value << 4) & 0xFF]),
          (err, bufferWritten, buffer) => {
            if (err) {
                return reject(err);
            }
            resolve(bufferWritten, buffer);
          });
    });
  },

  getServices: function() {
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "Mitsubishi")
        .setCharacteristic(Characteristic.Model, "Lossnay")
    services.push(infoService);

    var fanService = new Service.Fanv2(this.name);

    fanService
      .getCharacteristic(Characteristic.Active)
      .on('get', function(callback) {
        if (this.fanSpeed > 0) {
          callback(null, Characteristic.Active.ACTIVE);
        } else {
          callback(null, Characteristic.Active.INACTIVE);
        }
      }.bind(this))
      .on('set', function(state, callback) {
        console.log("Set Active: " + state);
        if (state === 0) {
          this.setFanSpeed(0);
        } else {
          this.setFanSpeed(1);
        }
        callback(null);
      }.bind(this));

    fanService
        .addCharacteristic(Characteristic.RotationSpeed)
        .setProps({
          minValue: 0,
          maxValue: 4,
          minStep: 1,
        })
        .on('get', function(callback) {
          callback(null, this.fanSpeed);
        }.bind(this))
        .on('set', function(value, callback) {
          this.setFanSpeed(value);
          callback(null);
        }.bind(this));

    services.push(fanService);
    return services;
  }
}