import * as fs from "fs";
import {UD3ConnectionType} from "../common/constants";
import {ConnectionPreset, IPC_CONSTANTS_TO_RENDERER} from "../common/IPCConstantsToRenderer";
import {AdvancedOptions} from "../common/Options";
import {FullConnectionOptions, UD3ConnectionOptions} from "../common/SingleConnectionOptions";
import {UIConfig} from "../common/UIConfig";
import {
    DEFAULT_SERIAL_PRODUCT,
    DEFAULT_SERIAL_VENDOR,
    getDefaultSerialPortForConfig,
} from "./connection/types/SerialCommon";
import {convertArrayBufferToString} from "./helper";
import {ipcs} from "./ipc/IPCProvider";


let uiConfig: UIConfig | undefined;
const FILENAME = 'tt-ui-config.json';

function makeDefaultConnectOptions(): FullConnectionOptions {
    return {
        serialOptions: {
            autoProductID: DEFAULT_SERIAL_PRODUCT,
            autoVendorID: DEFAULT_SERIAL_VENDOR,
            autoconnect: false,
            baudrate: 460_800,
            serialPort: getDefaultSerialPortForConfig(),
        },
        type: UD3ConnectionType.serial_min,
        udpOptions: {remoteIP: "localhost", udpMinPort: 1337},
    };
}

function makeDefaultAdvancedOptions(): AdvancedOptions {
    return {
        enableMIDIInput: false,
        midiOptions: {bonjourName: "Teslaterm", localName: "Teslaterm", port: 12001, runMidiServer: false},
        mixerOptions: {enable: false, ip: 'localhost', port: 5004},
        netSidOptions: {enabled: false, port: 6581},
    };
}

function fixConnectionPreset(
    preset: Partial<ConnectionPreset>, fallback: FullConnectionOptions, advanced: AdvancedOptions,
) {
    if (!preset.options.advanced) {
        preset.options.advanced = advanced;
    }
    preset.options.advanced = {...advanced, ...preset.options.advanced};
    preset.options = {
        ...fallback,
        ...preset.options,
        advanced: preset.options.advanced,
    };
}

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
    object.advancedOptions = {...object.advancedOptions, ...makeDefaultAdvancedOptions()};
    object.lastConnectOptions = {...object.lastConnectOptions, ...makeDefaultConnectOptions()};
    for (const preset of object.connectionPresets) {
        fixConnectionPreset(preset, object.lastConnectOptions, object.advancedOptions);
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
    ipcs.misc.syncUIConfig();
}

export function setLastConnectionOptions(options: UD3ConnectionOptions) {
    const newOptions: FullConnectionOptions = {...getUIConfig().lastConnectOptions};
    newOptions.type = options.connectionType;
    if (options.connectionType === UD3ConnectionType.udp_min) {
        newOptions.udpOptions = options.options;
    } else {
        newOptions.serialOptions = options.options;
    }
    setUIConfig({lastConnectOptions: newOptions});
}
