[![npm](https://badgen.net/npm/v/homebridge-dynamicapi/latest?icon=npm&label)](https://www.npmjs.com/package/homebridge-dynamicapi)
[![npm](https://badgen.net/npm/dt/homebridge-dynamicapi?label=downloads)](https://www.npmjs.com/package/homebridge-dynamicapi)
[![Donate](https://badgen.net/badge/donate/paypal/yellow)](https://paypal.me/IanW6374)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>


# homebridge-dynamicAPI

This is a Homebridge dynamic platform plugin which exposes remote light, temperature, humidity and garage door accessories through a remote API.  

### Features:

* Accessories are dynamically created through remote API when Homebridge is started
* Control remote accessories through API
* Support of dynamic updates from accessories to support garage door state monitoring and local garage door / light activation.
* Support of characteristic polling to improve Home application performance.


### Optional Features:

* HTTPS
* JSON Web Token Security (Auth0 Tested)
* Support of Self-Signed Certificate


## Install

The plugin can be installed by running the command:  sudo npm -g homebridge-dynamicapi


## Configuration

The configuration of the plugin can be done via the Homebrige GUI or through the Homebridge configuration file.

```
{
            "remoteApiDisplayName": "<display name>",
            "remoteApiURL": "https://host:8001/API-Endpoint/",
            "remoteApiRejectInvalidCert": false,
            "remoteApiCharPoll": [
                {
                    "Lightbulb": {
                        "enabled": false,
                        "On": true,
                        "Brightness": true,
                        "ColorTemperature": true,
                        "Hue": true,
                        "Saturation": true
                    },
                    "GarageDoorOpener": {
                        "enabled": false,
                        "CurrentDoorState": true,
                        "ObstructionDetected": true
                    },
                    "TemperatureSensor": {
                        "enabled": false,
                        "CurrentTemperature": true,
                        "StatusActive": true
                    },
                    "HumiditySensor": {
                        "enabled": false,
                        "CurrentRelativeHumidity": true,
                        "StatusActive": true
                    }
                }
            ],
            "remoteApiPollInt": 10,
            "directConnectApiPort": 8001,
            "directConnectApiHttps": false,
            "directConnectApiHttpsCertPath": "/<certificate path>/<certificate>",
            "directConnectApiHttpsKeyPath": "/<private key path>/<private key>",
            "jwt": false,
            "jwtAudience": "https://JWT-API-Application/",
            "jwtIssuer": "https://JWT-Issuer/",
            "jwtClientID": "<JWT Client ID>",
            "jwtClientSecret": "<JWT Client Secret>",
            "platform": "<dynamicAPI>"
        }

```

## DIRECT CONNECT API

* GET / - Shows all devices registered to Homebridge from this platform

* PATCH /API/ - Updates characteristic of accessory using the UUID field as the index


## REMOTE API

* GET /API/ - Shows API state
* GET /API/DEVICES/ - Shows all devices and their current status and characteristics
* GET /API/DEVICES/{uuid:} - Shows current status and characteristics of device with id = {uuid:}
* GET /API/DEVICES/{uuid:}/CHARACTERISTICS/ - Shows characteristics of device with id = {uuid:}
* GET /API/DEVICES/{uuid:}/CHARACTERISTICS/{char:}/ - Shows characteristic {char:} of device with id = {uuid:}

* PATCH /API/DEVICES/{uuid:} - Updates status and characteristics of device with id = {uuid:}
* PATCH /API/DEVICES/{uuid:}/CHARACTERISTICS/ - Updates characteristics of device with id = {uuid:}
* PATCH /API/DEVICES/{uuid:}/CHARACTERISTICS/{char:}/ - Update characteristic {char:} of device with id = {uuid:}


## ASSOCIATED REMOTE API IMPLEMENTATION

Please see project https://github.com/IanW6374/Raspberry-Garage for an implementation of the Remote API on the Raspberry Pi platform.


