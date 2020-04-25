# MMM-BluetoothDevices

*This package is still in testing/beta* 

Written in Javascript and utilizes the BlueZ Linux Bluetooth stack via its native D-Bus interface.

## Supported devices
| Device | Screenshot |
| --- | --- |
| Oral-B Smart Toothbrushes | ![Screenshot](/screenshots/oralbtoothbrush.png) |

## How it works
When running magic mirror and you open the web interface, if not already, the node_helper will start connecting and listening to your configured bluetooth device(s).

## Installation
Navigate into your MagicMirror's modules folder and execute:
```bash
git clone https://github.com/timodejong95/MMM-BluetoothDevices.git
cd MMM-BluetoothDevices
npm install
sudo cp setup/MMM.conf /etc/dbus-1/system.d/MMM.conf
```

### Config file
To run own services (GATT) we need to permission to start a service on the system D-Bus.

Copy and move the `setup/MMM.conf` into the following directory: `/etc/dbus-1/system.d/`.

*In the file the users `pi` and `root` are granted permission.*

### Docker
If your running MagicMirror in [docker](https://docs.magicmirror.builders/getting-started/installation.html#docker-image) you need to add the following volume mounts:
- /var/run/dbus/system_bus_socket:/var/run/dbus/system_bus_socket
- /etc/dbus-1/system.d/MMM.conf:/etc/dbus-1/system.d/MMM.conf

## Configuration

### Example
| Key | Type | Default | Description |
| --- | --- | --- | --- |
| name | String | `raspberrypi` | the name for the running bluetooth adapter |
| mode | String | `le` | |
| hci | String | `hci0` | which hci adapter to use, run `hciconfig` to see your available hci adapters |
| interfaceName | String | `org.bluez.Adapter1` | the bluetooth adapter name to take |
| hideAfter | Number | `600` | the time in seconds when a device should hide |
| debugLogs | Boolean | `false` | enable debug logging |
| services | Array | `{ type: "CurrentTimeService" }` | bluetooth GATT services |
| services.type | String | | the service name, see [services](#services) |
| devices | Array | `[]` | the bluetooth devices |
| devices[] | Object | | a bluetooth device |
| devices[].type | String | | the device name, see [devices](#devices) |
| devices[].name | String | | the name for the devices, can be used in `layout.data.fields` |
| devices[].mac | String | | the device bluetooth mac |
| devices[].format | String | | the device format, see [devices format](#devices) |
| devices[].tracks | Array | `[]` | custom devices tracks |
| devices[].tracks[] | String | | the track key, see [devices tracks](#devices) |
| devices[].servicesResolvedTimeout | String | `15000` | the amount of milliseconds to wait for the devices to resolve the services |
| layout | Object | | |
| layout.title | Object | | |
| layout.title.position | String | `bottom` | either `top` or `bottom` |
| layout.title.key | String | `name` | the key of the [device data](#devices) to show |
| layout.data | Object | | |
| layout.data.position | String | `bottom` | either `top` or `bottom` |
| layout.data.fields | Array | `{ key: "mode", text: "mode" }` | the custom fields |
| layout.data.fields[] | Object | | a custom field |
| layout.data.fields[].key | String | | the label |
| layout.data.fields[].text | String | | the key of the [device data](#devices) to show |

### Example
```
{
  module: "MMM-BluetoothDevices",
  position: "top_bar",
  config: {
    devices: [
      { type: "OralBToothbrush", name: "oralb", mac: "XX:XX:XX:XX:XX:XX" }
    ]
  }
}
```

### Devices
 - OralBToothbrush

#### Oral-B Toothbrush

##### Data
| Key | Type |
| --- | --- |
| state | String |
| pressure | String |
| time | Int |
| mode | String |
| sector | String |
| battery | Int |

##### Format
| Key | Description |
| --- | --- |
| counter | time |
| formatted | M:SS |

##### Tracks
| Key | Description |
| --- | --- |
| Battery | Can only be fetched when connected (device auto disconnect after ~20 seconds). So we got data when starting up and we try to reconnect in the first 5 seconds of your brush session. |

### Services
 - CurrentTimeService
 
## Troubleshooting
When occurring exceptions, that are thrown by the module, there is a `troubleshooting` key provided which corresponds to the following possible solutions:

| Keys | Possible Solutions |
| --- | --- |
| services#destroy | - |
| services#invalid-adapter<br>dongle#interface | make sure your hci adapter is configure correctly, run `hciconfig` to see which hci adapters are available |
| devices#could-not-connect<br>dongle#device-interface | make sure your bluetooth mac is correct, device is on and ready for pairing when the node_helper is triggered |
| devices#connect-error | - |
| devices#resolve-services | - |
| devices#characteristics | - |
| devices#service-interface | - |
| devices#service-characteristic-interface | - |
| dongle#stop-discovery | you might have re-started the magic-mirror to many times in a short period, please wait 30 seconds before the next start |
| dongle#start-discovery-filter | - |
| dongle#start-discovery | - |

## Development
I tried to make this package as generic as possible to allow support for more devices.
If you have any tips/suggestions or want to create support for a new bluetooth device let me know.
 
## Credits
Credits to [Hypfer/Cybele](https://github.com/Hypfer/Cybele) I used this package to see how to make connection with bluetooth devices.
