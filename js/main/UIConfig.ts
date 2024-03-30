import * as fs from "fs";
import {UD3ConnectionType} from "../common/constants";
import {ConnectionPreset} from "../common/IPCConstantsToRenderer";
import {getDefaultAdvancedOptions} from "../common/TTConfig";
import {
    DEFAULT_SERIAL_PRODUCT,
    DEFAULT_SERIAL_VENDOR,
    getDefaultSerialPortForConfig,
} from "./connection/types/SerialCommon";
import {convertArrayBufferToString} from "./helper";
import {config} from "./init";

export interface UIConfig {
    connectionPresets: ConnectionPreset[];
    darkMode: boolean;
    centralTelemetry: string[];
    // TODO get from UD3, or at least set from VMS file?
    midiPrograms: string[];
}

let uiConfig: UIConfig | undefined;
const FILENAME = 'tt-ui-config.json';

function getFileData() {
    const object: Partial<UIConfig> = (() => {
        try {
            const json = convertArrayBufferToString(fs.readFileSync(FILENAME));
            return JSON.parse(json);
        } catch (x) {
            console.warn("Failed to read UI config:", x);
            return {};
        }
    })();
    if (object.connectionPresets === undefined) {
        object.connectionPresets = [];
    }
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
    if (object.darkMode === undefined) {
        object.darkMode = false;
    }
    if (object.centralTelemetry === undefined) {
        object.centralTelemetry = [];
    }
    if (object.midiPrograms === undefined) {
        // Matches VMS.example.mcf
        object.midiPrograms = [
            "default", "Synthkeyboard", "SynthTrump", "piano", "Trumpo", "Seashore", "Synth Drum", "reverse cymbal",
            "Bells", "wannabe Guitar", "Drum Map", "SortOf Organ", "80s Synth",
        ];
    }
    return object as UIConfig;
}

export function getUIConfig() {
    if (!uiConfig) {
        uiConfig = getFileData();
    }
    return uiConfig;
}

export function setUIConfig(newConfig: Partial<UIConfig>) {
    uiConfig = {...uiConfig, ...newConfig};
    fs.writeFileSync(FILENAME, JSON.stringify(uiConfig));
}
