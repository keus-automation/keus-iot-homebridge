/* eslint-disable max-len */
import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';
import { dynamicAPIPlatform } from './platform';

/**
 * Garage Door Accessory
 */
export class GarageDoorAccessory {
  private service: Service
  private charParams
  private charMap

  constructor(
    private readonly platform: dynamicAPIPlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // Supported accessory characteristics
    this.charParams = {
      CurrentDoorState: {required: true, get: true, set: false},
      TargetDoorState: {required: true, get: true, set: true},
      ObstructionDetected: {required: true, get: true, set: false},
    };

    // set accessory information
    this.charMap = {
      true: 'True',
      false: 'False',
      0:'Open',
      1:'Closed',
      2:'Opening',
      3:'Closing',
      4:'Stopped',
    };

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Home')
      .setCharacteristic(this.platform.Characteristic.Model, 'Garage Door')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.uuid);

    this.service = this.accessory.getService(this.platform.Service.GarageDoorOpener) || this.accessory.addService(this.platform.Service.GarageDoorOpener);

    // set the service name - this is what is displayed as the default name on the Home app
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    // register handlers for the Characteristics
    for (const char in this.charParams) {

      if (accessory.context.device.characteristics[char] !== undefined) {
        // SET - bind to the `setChar` method below
        if (this.charParams[char].set === true) {
          this.service.getCharacteristic(this.platform.Characteristic[char])
            .on('set', this.setChar.bind(this, [char]));
          this.platform.log.info(`[${this.platform.config.remoteApiDisplayName}] [Device Info]: ${this.accessory.context.device.name} registered for (${char}) SET characteristic`);
        }
        // GET - bind to the `getChar` method below  
        if (this.charParams[char].get === true) {
          this.service.getCharacteristic(this.platform.Characteristic[char])
            .on('get', this.getChar.bind(this, [char]));
          this.platform.log.info(`[${this.platform.config.remoteApiDisplayName}] [Device Info]: ${this.accessory.context.device.name} registered for (${char}) GET characteristic`);
        }
        // Poll Device Characteristics Periodically and Update HomeKit
        if (this.platform.config.remoteApiCharPoll[0].GarageDoorOpener.enabled && this.platform.config.remoteApiCharPoll[0].GarageDoorOpener[char]) {
          setInterval (async () => {
            const device = await this.platform.remoteAPI('GET', `${this.accessory.context.device.uuid}/characteristics/${char}`, '');
            if (!device['errno'] && this.checkChar(char, device[char])) {
              this.service.updateCharacteristic(this.platform.Characteristic[char], device[char]);
              this.platform.log.info(`[Homebridge] [Device Info]: (${this.accessory.context.device.name} | ${char}) is (${device[char]})`);
            } else {
              if (!device['errno']) {
                this.platform.log.warn(`[Homebridge] [Device Warning]: (${this.accessory.context.device.name} | ${char}) invalid value (${device[char]})`);
              }
            }
          }, this.platform.config.remoteApiPollInt*1000);
        }
      } else {
        if (this.charParams[char].required === true) {
          this.platform.log.error(`[${this.platform.config.remoteApiDisplayName}] [Device Error]: ${this.accessory.context.device.name} missing required (${char}) characteristic`);
        }
      }
    } 
  }
      
  
  /**
   * Handle "SET" requests from Direct Connect API
   * These are sent when the user changes the state of an accessory locally on the device.
   */
  async updateChar (chars) {

    for (const char in chars) {
      if (this.checkChar(char, chars[char])) {
        this.service.updateCharacteristic(this.platform.Characteristic[char], chars[char]);
        this.platform.log.info(`[${this.platform.config.remoteApiDisplayName}] [Device Event]: (${this.accessory.context.device.name} | ${char}) set to (${this.charMap[chars[char]]})`);
      } else {
        this.platform.log.warn(`[${this.platform.config.remoteApiDisplayName}] [Device Warning]: (${this.accessory.context.device.name} | ${char} | ${chars[char]}) invalid characteristic or value`);
      }
    }
  }

    
  /**
   * Handle "SET" characteristics requests from HomeKit
   */
  setChar (char, charValue: CharacteristicValue, callback: CharacteristicSetCallback) {
    const device = this.platform.remoteAPI('PATCH', this.accessory.context.device.uuid, `{"${char}": ${charValue}}`);
    if (!device['errno']) {
      this.platform.log.info(`[HomeKit] [Device Event]: (${this.accessory.context.device.name} | ${char}) set to (${this.charMap[`${charValue}`]})`);
    }
    callback(null);
  }

  
  /**
   * Handle "GET" characteristics requests from HomeKit
   */
  async getChar(char, callback: CharacteristicGetCallback) {
    const device = await this.platform.remoteAPI('GET', `${this.accessory.context.device.uuid}/characteristics/${char}`, '');
    if (!device['errno'] && this.checkChar(char, device[char])) {
      this.platform.log.info(`[HomeKit] [Device Info]: (${this.accessory.context.device.name} | ${char}) is (${this.charMap[device[char]]})`);
      callback(null, device[char]);
    } else {
      if (!device['errno']) {
        this.platform.log.warn(`[HomeKit] [Device Warning]: (${this.accessory.context.device.name} | ${char}) invalid value (${device[char]})`);
      }
      // callback with error
      // callback(new Error('Invalid Value'));

      //callback with cached value
      const charVal = this.service.getCharacteristic(this.platform.api.hap.Characteristic[char]).value;
      callback(null, charVal);
    }
  }

  /**
   * Check characteristic value is valid
   */
  checkChar(char, charValue) {
    
    if (char in this.charParams) {

      const charType = this.service.getCharacteristic(this.platform.api.hap.Characteristic[char]).props.format;
      const charMin = this.service.getCharacteristic(this.platform.api.hap.Characteristic[char]).props.minValue || 0;
      const charMax = this.service.getCharacteristic(this.platform.api.hap.Characteristic[char]).props.maxValue || 0;

      if (charType === 'bool' && typeof charValue === 'boolean') {
        return true;
      } else if ((charType === 'float' || charType === 'int' || charType === 'uint8') && charValue >= charMin && charValue <= charMax){
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }
}

