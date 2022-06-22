/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-len */
import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { GarageDoorAccessory } from './GarageDoorAccessory';
import { LightAccessory } from './LightAccessory';
import {ThermostatAccessory} from './Thermostat';
import {FanAccessory} from './Fan';
import { TemperatureSensorAccessory } from './TemperatureSensorAccessory';
import { HumiditySensorAccessory } from './HumiditySensorAccessory';
import { WindowCoveringAccessory } from './WindowCovering';
import fetch from 'node-fetch';
import express from 'express';
import https from 'https';
import fs from 'fs';
import jwt from 'express-jwt';
import jwtAuthz from 'express-jwt-authz';
import jwksRsa from 'jwks-rsa';
import os from 'os';

/**
 * Homebridge Platform
 */

export class dynamicAPIPlatform implements DynamicPlatformPlugin {

  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  
  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  // this is used to track platform accessories for dynamic updates
  deviceAccessories: any[];
  deviceAccessoryTypes: any[];

  // this is used to store the remote API JSON Web Token (JWT)
  apiJWT

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
    
  ) {
    this.log.info(`[Platform Event]:  ${PLATFORM_NAME} platform Initialized`);

    this.deviceAccessories = [];

    this.deviceAccessoryTypes = [
      'Garage Door Opener',
      'Lightbulb',
      'Temperature Sensor',
      'Humidity Sensor',
      'Fan',
      'Thermostat',
      'Window Covering'
    ];

    this.apiJWT = {
      'access_token': '',
      'token_type': '',
      'expires': 0,
      'scope': '',
      'valid': false,
    };

    /** 
     * When this event is fired it means Homebridge has restored all cached accessories from disk.
     * Dynamic Platform plugins should only register new accessories after this event was fired,
     * in order to ensure they weren't added to homebridge already. This event can also be used
     *to start discovery of new accessories.
     */
    this.api.on('didFinishLaunching', async () => {

      // Discover & register your devices as accessories
      await this.discoverDevices();

      // Start Direct Connect API Service
      this.webServer();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info(`[Platform Event]:  Restored Device (${accessory.displayName}) from Homebridge Cache`);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  // Discover devices via remote API.
  async discoverDevices() {

    const discoveredDevices = await this.remoteAPI('GET', '', '');

    if (!discoveredDevices['errno']) {

      // loop over the discovered devices and register each one if it has not already been registered
      try {
        for (const device of discoveredDevices) {

          // generate a unique id for the accessory
          const uuid = this.api.hap.uuid.generate(device.uuid);

          // see if an accessory with the same uuid has already been registered and restored from
          // the cached devices we stored in the `configureAccessory` method above
          const accessory = this.accessories.find(accessory => accessory.UUID === uuid);

          // the accessory already exists
          if (accessory) {
          
            this.log.info(`[Platform Event]:  Restored Device (${device.name}) from ${this.config.remoteApiDisplayName}`);
          
            // Update accessory context
            accessory.context.device = device;

            // create the accessory handler for the restored accessory
            if(device.type === 'Garage Door Opener') {
              this.deviceAccessories.push(new GarageDoorAccessory(this, accessory));
            } else if (device.type === 'Lightbulb') {
              this.deviceAccessories.push(new LightAccessory(this, accessory));
            } else if (device.type === 'Temperature Sensor') {
              this.deviceAccessories.push(new TemperatureSensorAccessory(this, accessory));
            } else if (device.type === 'Humidity Sensor') {
              this.deviceAccessories.push(new HumiditySensorAccessory(this, accessory));
            } else if(device.type==='Thermostat'){
              this.deviceAccessories.push(new ThermostatAccessory(this, accessory));
            } else if(device.type==='Fan'){
              this.deviceAccessories.push(new FanAccessory(this, accessory));
            }else if(device.type==='Window Covering'){
              this.deviceAccessories.push(new WindowCoveringAccessory(this, accessory));
            }else {
              this.log.warn(`[Platform Warning]:  Device Type No Longer Supported (${device.name} | ${device.type})`);
            }

          // the accessory does not yet exist, so we need to create it
          } else if (this.deviceAccessoryTypes.includes(device.type)){

            // create a new accessory
            const accessory = new this.api.platformAccessory(device.name, uuid);

            // store a copy of the device object in the `accessory.context`
            accessory.context.device = device;

            // create the accessory handler for the restored accessory
            if(device.type === 'Garage Door Opener') {
              this.deviceAccessories.push(new GarageDoorAccessory(this, accessory));
            } else if (device.type === 'Lightbulb') {
              this.deviceAccessories.push(new LightAccessory(this, accessory));
            } else if (device.type === 'Temperature Sensor') {
              this.deviceAccessories.push(new TemperatureSensorAccessory(this, accessory));
            } else if (device.type === 'Humidity Sensor') {
              this.deviceAccessories.push(new HumiditySensorAccessory(this, accessory));
            } else if(device.type==='Thermostat'){
              this.deviceAccessories.push(new ThermostatAccessory(this, accessory));
            } else if(device.type==='Fan'){
              this.deviceAccessories.push(new FanAccessory(this, accessory));
            } else if(device.type==='Window Covering'){
              this.deviceAccessories.push(new WindowCoveringAccessory(this, accessory));
            }
          
            // Add the new accessory to the accessories cache
            this.accessories.push(accessory);

            // link the accessory to your platform
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

            this.log.info(`[Platform Event]:  Added New Device (${device.name} | ${device.type}) from ${this.config.remoteApiDisplayName}`);
          } else {
            this.log.warn(`[Platform Warning]:  Device Type Not Supported (${device.name} | ${device.type})`);
          }
          
        } 
    
        // Delete an old accessory
        if (this.accessories.length > discoveredDevices.length) {

          for (let accessoryIndex = this.accessories.length - 1; accessoryIndex > 0; accessoryIndex --) {
            if (discoveredDevices.findIndex(devices => devices.uuid === this.accessories[accessoryIndex].context.device.uuid) === -1) { 
              const accessory = this.accessories[accessoryIndex];
              this.api.unregisterPlatformAccessories('PLUGIN_NAME', 'PLATFORM_NAME', [accessory]);
              this.log.info(`[Platform Event]:  Deleted Device (${this.accessories[accessoryIndex].context.device.name})`);
              this.accessories.splice(accessoryIndex, 1);
            }
          }
        }
      } catch {
        this.log.error('[Platform Error]:  Invalid response from remote API');
      }
    } 
  }


  updateDevice(req, res) {

    if (this.deviceAccessories.length === 0) {
      this.log.warn(`[Platform Warning]: No devices synchronised from ${this.config.remoteApiDisplayName}`);
      res.status(404).send(`WARNING: No devices synchronised from ${this.config.remoteApiDisplayName}`);
    } else {
     
      const accessoryIndex = this.accessories.findIndex(accessory => accessory.context.device.uuid === req.body.uuid);

      if (accessoryIndex === -1){
        this.log.warn(`[Platform Warning]: Device with uuid: ${req.body.uuid} not found`);
        res.status(404).send(`WARNING: Device with uuid: ${req.body.uuid} not found`);

      } else {

        if (this.deviceAccessoryTypes.includes(this.accessories[accessoryIndex].context.device.type)) {
          
          const chars = {};
          Object.assign(chars, req.body.characteristics);
          this.deviceAccessories[accessoryIndex].updateChar(chars);
          res.send(JSON.stringify(this.accessories[accessoryIndex].context.device));
      
        } else {
          
          this.log.info(`[Platform Warning]: Device with type: (${req.body.uuid} | ${req.body.type}) not found`);
          res.status(404).send(`WARNING: Device with type: (${req.body.uuid} | ${req.body.type}) not found`);
        }
      }
    }
  }


  async getAuthToken() {
    
    const url = `${this.config.jwtIssuer}oauth/token`;
    
    // send POST request
    await fetch(url, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: `{"client_id":"${this.config.jwtClientID}","client_secret":"${this.config.jwtClientSecret}","audience":"${this.config.jwtAudience}","grant_type":"client_credentials"}`,
    })
      .then(res => {
        if (res.ok) { // res.status >= 200 && res.status < 300
          this.log.info(`[Platform Info]:  ${this.config.remoteApiDisplayName} JWT Fetch Success: ${res.status}`);
          return res;
        } else {
          throw new Error(`${res.status}`);
        }
      })
      .then(res => res.json())
      .then(res => {
        if (res === undefined) {
          this.apiJWT.valid = false; 
        } else {
          this.apiJWT = {
            'access_token': res.access_token,
            'token_type': res.token_type,
            'expires': Date.now() + (res.expires_in * 1000),
            'scope': res.scope,
            'valid': true,
          };
        } 
      })
      .catch(error => this.log.error(`[Platform Error]:  ${this.config.remoteApiDisplayName} JWT Fetch Failure: ${error}`));
  }

  
  async webServer() {

    const WebApp = express();
    WebApp.use(express.json());
    const options = {};
    let error = false;
    const directConnectApiIP = this.config.directConnectApiIP || this.getIPAddress();

    // Secure API - jwt
    const checkJwt = jwt({
      secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${this.config.jwtIssuer}.well-known/jwks.json`,
      }),

      audience: `${this.config.jwtAudience}`,
      issuer: `${this.config.jwtIssuer}`,
      algorithms: ['RS256'],
    });

    const checkScopes = jwtAuthz([ 'write:api' ]);
    

    // Initialise Direct Connect API
    if (this.config.directConnectApiHttps === true){

      try {
        fs.accessSync (`${this.config.directConnectApiHttpsCertPath}`, fs.constants.R_OK);
        const cert = fs.readFileSync(`${this.config.directConnectApiHttpsCertPath}`);
        options['cert'] = cert;
      } catch (err) {
        this.log.error(`[Platform Error]:  Direct Connect API HTTPS Certificate file does not exist or unreadable: ${err}`);
        error = true;
      }

      try {
        fs.accessSync (`${this.config.directConnectApiHttpsKeyPath}`, fs.constants.R_OK);
        const key = fs.readFileSync(`${this.config.directConnectApiHttpsKeyPath}`);
        options['key'] = key;
      } catch (err) {
        this.log.error(`[Platform Error]:  Direct Connect API HTTPS Private Key file does not exist or unreadable: ${err}`);
        error = true;
      }

      if (!error) {
        https.createServer(options, WebApp).listen(this.config.directConnectApiPort, directConnectApiIP, () => {
          this.log.info(`[Platform Info]:  Direct Connect API service started at https://${directConnectApiIP}:${this.config.directConnectApiPort}`);
        });
      } 
    } else {
      WebApp.listen(this.config.directConnectApiPort, directConnectApiIP, () => {
        this.log.info(`[Platform Info]:  Direct Connect API service started at http://${directConnectApiIP}:${this.config.directConnectApiPort}`);
      });
    }

    if (!error) {   
      // Create Direct Connect API GET Route Response
      let apiGetResponse = '';

      if (this.deviceAccessories.length === 0) {
        apiGetResponse = `[${this.config.remoteApiDisplayName}] [Platform Info]:  No devices synchronised`;
      } else {
        this.accessories.forEach(item => {
          apiGetResponse += `name: ${item.context.device.name} uuid: ${item.context.device.uuid} type: ${item.context.device.type}<br>`;
        });
      }

      // Create Direct Connect API GET API Routes
      WebApp.get( '/', ( req, res ) => {
        res.send(`[${this.config.remoteApiDisplayName}] [Platform Info]:  Homebridge Direct Connect API Running`);
        this.log.info('[Platform Info]:  GET Direct Connect API Status');
      });
    
      WebApp.get( '/api/', ( req, res ) => {
        if (this.config.jwt === true){
          res.send(`[${this.config.remoteApiDisplayName}] [Platform Info]:  Homebridge Direct Connect API Running <br><br>${apiGetResponse}`);
          this.log.info('[Platform Info]:  GET All Accessory information and Direct Connect API Status');
        } else {
          res.send(`[${this.config.remoteApiDisplayName}] [Platform Info]:  Homebridge Direct Connect API Running <br><br>${apiGetResponse}`);
          this.log.info('[Platform Info]:  GET All Accessory information and Direct Connect API Status');
        }
      });

      // Create Direct Connect API PATCH API Route
      if (this.config.jwt === true){
        WebApp.patch('/api/', checkJwt, checkScopes, async (req, res) => this.updateDevice(req, res));
      } else {
        WebApp.patch('/api/', async (req, res) => this.updateDevice(req, res));
      }

      // Create Direct Connect API Error Handler
      WebApp.use((err, req, res, next) => {
        if (!err) {
          return next();
        } else {
          this.log.debug(`[Platform Error]:  Direct Connect API Service: ${err}`);
          res.status(err.status).send(`[${this.config.remoteApiDisplayName}]  ERROR:  Direct Connect API Service: ${err}`);
        }
      });
      return;
    }
  }


  async remoteAPI (method, endpoint, body) {

    if (this.validURL(this.config.remoteApiURL)) {

      if (this.config.jwt && (this.apiJWT.valid === false || this.apiJWT.expires <= Date.now() + 60000)) {
        await this.getAuthToken(); 
      }
      if (this.apiJWT.status === false && this.config.jwt === true) {
        this.log.error(`[Platform Error]:  No valid ${this.config.remoteApiDisplayName} JWT to discover devices`);

        const error = {'errno': `No valid ${this.config.remoteApiDisplayName} JWT to discover devices`};
        return error;

      } else {

        const url = (this.config.remoteApiURL.endsWith('/')) ? this.config.remoteApiURL + endpoint : this.config.remoteApiURL + '/' + endpoint;
        const jwtHeader = {'content-type': 'application/json', 'authorization': `${this.apiJWT.token_type} ${this.apiJWT.access_token}`};
        const headers = (this.config.jwt) ? jwtHeader : {'content-type': 'application/json'};

        let options = {};

        if (this.config.remoteApiRejectInvalidCert === false && this.config.remoteApiURL.indexOf('https') === 0) {
          const agent = new https.Agent({
            rejectUnauthorized: false,
          });
          options = {
            method: method,
            headers: headers,
            agent,
          };
        } else {
          options = {
            method: method,
            headers: headers,
          };
        }
        
        if (method === 'POST' || method === 'PATCH') {
          options['body'] = body;
        }
      
        // send Method request
        const response = await fetch(url, options)
          .then(res => {
            if (res.ok) { // res.status >= 200 && res.status < 300
              return res;
            } else {
              throw new Error(`${res.status}`);
            }
          })
          .then(res => res.json())
          .then(res => {
            return res;
          })
          .catch(error => {
            this.log.error(`[Platform Error]:  ${this.config.remoteApiDisplayName} ${method} Failure: ${error}`);
            return error;
          });
        return response;
      }
    } else {
      this.log.error(`[Platform Error]:  Invalid Remote API URL - ${this.config.remoteApiURL}`);
      const error = {'errno': `Invalid Remote API URL - ${this.config.remoteApiURL}`}; 
      return error;
    }
  }
  
  getIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const deviceName in interfaces) {
      const iface = interfaces[deviceName];
      for (let i = 0; i < iface!.length; i++) {
        const alias = iface![i];
        if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
          return alias.address;
        }
      }
    }
    return '0.0.0.0';
  }

  validURL(str: string) {
    const pattern = new RegExp(
      '^(https?:\\/\\/)'+  //scheme
      '((([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])|'+  // IPv4
      '(([a-zA-Z]|[a-zA-Z][a-zA-Z0-9\\-]*[a-zA-Z0-9])\\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9\\-]*[A-Za-z0-9]))'+  // hostname
      '(:([0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5]))'+  // port
      '?(\\/[-a-zA-Z\\d%_.~+]*)*$');  // path
    return !!pattern.test(str);
  }
}
  

