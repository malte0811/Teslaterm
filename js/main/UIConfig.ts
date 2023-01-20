import * as fs from "fs";
import {UD3ConnectionType} from "../common/constants";
import {ConnectionPreset} from "../common/IPCConstantsToRenderer";
import {getDefaultAdvancedOptions} from "../common/TTConfig";
import {
    DEFAULT_SERIAL_PRODUCT,
    DEFAULT_SERIAL_VENDOR,
    getDefaultSerialPortForConfig
} from "./connection/types/serial_plain";
import {convertArrayBufferToString} from "./helper";
import {config} from "./init";

export interface UIConfig {
    connectionPresets: ConnectionPreset[];
}

let uiConfig: UIConfig | undefined;
const FILENAME = 'tt-ui-config.json';

function getFileData() {
    try {
        const json = convertArrayBufferToString(fs.readFileSync(FILENAME));
        const object: UIConfig = JSON.parse(json);
        for (const preset of object.connectionPresets) {
            if (!preset.options.advanced) {
                preset.options.advanced = getDefaultAdvancedOptions(config);
            }
            const type = preset.options.connectionType;
            if (type === UD3ConnectionType.serial_min || type === UD3ConnectionType.serial_plain) {
                const options = preset.options.options;
                if (options.autoconnect === undefined) {
                    options.autoconnect = options.serialPort && options.serialPort !== "";
                }
                options.serialPort = options.serialPort || getDefaultSerialPortForConfig();
                options.autoProductID = options.autoProductID || DEFAULT_SERIAL_PRODUCT;
                options.autoVendorID = options.autoVendorID || DEFAULT_SERIAL_VENDOR;
            }
        }
        return object;
    } catch (x) {
        console.log("Failed to read UI config:", x);
    }
}

export function getUIConfig() {
    if (!uiConfig) {
        uiConfig = {connectionPresets: [], ...getFileData()};
    }
    return uiConfig;
}

export function setUIConfig(newConfig: UIConfig) {
    uiConfig = newConfig;
    fs.writeFileSync(FILENAME, JSON.stringify(newConfig));
}
