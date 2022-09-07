/* eslint-disable max-len */
import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback, HAPStatus} from 'homebridge';
import { dynamicAPIPlatform } from './platform';

/**
 * Light Accessory
 */
export class LightAccessory {
  private service: Service
  private charParams

  constructor(
    private readonly platform: dynamicAPIPlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // Supported accessory characteristics
    this.charParams = {
      On: {required: true, get: true, set: true},
      Brightness: {required: false, get: true, set: true},
      ColorTemperature: {required: false, get: true, set: true},
      Hue: {required: false, get: true, set: true},
      Saturation: {required: false, get: true, set: true},
    };

    this.platform.log.info("!!!lightbulb characteristics "+JSON.stringify(accessory.context.device));
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Keus')
      .setCharacteristic(this.platform.Characteristic.Model, 'Light')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.uuid);


    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);
    
    // set the service name, this is what is displayed as the default name on the Home app
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
        
        //ignore getChar for scene siche it is stateless
        if (this.charParams[char].get === true ) {
          this.service.getCharacteristic(this.platform.Characteristic[char])
            .on('get', this.getChar.bind(this, [char]));
          this.platform.log.info(`[${this.platform.config.remoteApiDisplayName}] [Device Info]: ${this.accessory.context.device.name} registered for (${char}) GET characteristic`);
        }
        // Poll Device Characteristics Periodically and Update HomeKit
        if (this.platform.config.remoteApiCharPoll[0].Lightbulb.enabled && this.platform.config.remoteApiCharPoll[0].Lightbulb[char]) {
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
        this.platform.log.info(`[${this.platform.config.remoteApiDisplayName}] [Device Event]: (${this.accessory.context.device.name} | ${char}) set to (${chars[char]})`);
      } else {
        this.platform.log.warn(`[${this.platform.config.remoteApiDisplayName}] [Device Warning]: (${this.accessory.context.device.name} | ${char} | ${chars[char]}) invalid characteristic or value`);
      }
    }
  }

    
  /**
   * Handle "SET" characteristics requests from HomeKit
   */
  async setChar (char, charValue: CharacteristicValue, callback: CharacteristicSetCallback) {
    
    const device = await this.platform.remoteAPI('PATCH', this.accessory.context.device.uuid, `{"${char}": ${charValue}}`);
    if (!device['errno']) {
      this.platform.log.info(`[HomeKit] [Device Event]: (${this.accessory.context.device.name} | ${char}) set to (${charValue})`);
    }
    //callback(null);
    callback( device.success?HAPStatus.SUCCESS:HAPStatus.SERVICE_COMMUNICATION_FAILURE);
  }

  
  /**
   * Handle "GET" characteristics requests from HomeKit
   */
  async getChar(char, callback: CharacteristicGetCallback) {
    const uuid:string=this.accessory.context.device.uuid;
    let charVal;
    
    //if accesory is a scene then do not make API request to fetch the state since scene is stateless
    if((uuid).substring(uuid.length-3, uuid.length)=="SCN"){
      charVal=JSON.stringify({"On":false});
    }
    else{
      const device = await this.platform.remoteAPI('GET', `${this.accessory.context.device.uuid}/characteristics/${char}`, '');
      if (!device['errno'] && this.checkChar(char, device[char])) {
        this.platform.log.info(`[HomeKit] [Device Info]: (${this.accessory.context.device.name} | ${char}) is (${device[char]})`);
        callback(null, device[char]);
      } else {
        if (!device['errno']) {
          this.platform.log.warn(`[HomeKit] [Device Warning]: (${this.accessory.context.device.name} | ${char}) invalid value (${device[char]})`);
        }
        // callback with error
        // callback(new Error('Invalid Value'));

        //callback with cached value
        charVal = this.service.getCharacteristic(this.platform.api.hap.Characteristic[char]).value;
      }
    }
    callback(null, charVal);
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
      } else if ((charType === 'float' || charType === 'int') && charValue >= charMin && charValue <= charMax){
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }
}
