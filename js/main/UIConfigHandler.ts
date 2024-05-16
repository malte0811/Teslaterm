import * as fs from "fs";
import {UD3ConnectionType} from "../common/constants";
import {ChannelID, ConnectionPreset} from "../common/IPCConstantsToRenderer";
import {AdvancedOptions} from "../common/Options";
import {FullConnectionOptions, UD3ConnectionOptions} from "../common/SingleConnectionOptions";
import {CoilMixerState, FullUIConfig, SavedMixerState, SyncedUIConfig} from "../common/UIConfig";
import {VolumeKey, VolumeUpdate} from "../common/VolumeMap";
import {getOptionalUD3Connection} from "./connection/connection";
import {
    DEFAULT_SERIAL_PRODUCT,
    DEFAULT_SERIAL_VENDOR,
    getDefaultSerialPortForConfig,
} from "./connection/types/SerialCommon";
import {convertArrayBufferToString} from "./helper";
import {ipcs} from "./ipc/IPCProvider";


let uiConfig: FullUIConfig | undefined;
const FILENAME = 'tt-ui-config.json';

function fixConnectionOptions(options: Partial<FullConnectionOptions>): FullConnectionOptions {
    if (!options) {
        options = {};
    }
    if (options.type === undefined) {
        options.type = UD3ConnectionType.serial_min;
    }
    options.serialOptions = {
        autoProductID: DEFAULT_SERIAL_PRODUCT,
        autoVendorID: DEFAULT_SERIAL_VENDOR,
        autoconnect: false,
        baudrate: 460_800,
        serialPort: getDefaultSerialPortForConfig(),
        ...options.serialOptions,
    };
    options.udpOptions = {
        remoteDesc: 'None',
        remoteIP: "localhost",
        udpMinPort: 1337,
        useDesc: false,
        ...options.udpOptions,
    };
    return options as FullConnectionOptions;
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

function fixSyncedConfig(object: Partial<SyncedUIConfig>) {
    if (object.connectionPresets === undefined) {
        object.connectionPresets = [];
    }
    object.advancedOptions = {...makeDefaultAdvancedOptions(), ...object.advancedOptions};
    object.lastConnectOptions = fixConnectionOptions(object.lastConnectOptions);
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
    return object as SyncedUIConfig;
}

function getFileData() {
    let object: Partial<FullUIConfig> = (() => {
        try {
            const json = convertArrayBufferToString(fs.readFileSync(FILENAME));
            return JSON.parse(json);
        } catch (x) {
            console.warn("Failed to read UI config:", x);
            return {};
        }
    })();
    if (object.syncedConfig === undefined) {
        object = {syncedConfig: fixSyncedConfig(object as Partial<SyncedUIConfig>)};
    } else {
        object.syncedConfig = fixSyncedConfig(object.syncedConfig);
    }
    if (object.mixerStateBySong === undefined) {
        object.mixerStateBySong = {};
    }
    return object as FullUIConfig;
}

// TODO check usages, probably stop syncing bits of this in addition to the full thing
export function getUIConfig() {
    if (!uiConfig) {
        uiConfig = getFileData();
    }
    return uiConfig;
}

function saveConfig() {
    fs.writeFileSync(FILENAME, JSON.stringify(getUIConfig()));
}

export function setUIConfig(newConfig: Partial<SyncedUIConfig>) {
    uiConfig.syncedConfig = {...uiConfig.syncedConfig, ...newConfig};
    saveConfig();
    ipcs.misc.syncUIConfig();
}

export function setLastConnectionOptions(options: UD3ConnectionOptions) {
    const newOptions: FullConnectionOptions = {...getUIConfig().syncedConfig.lastConnectOptions};
    newOptions.type = options.connectionType;
    if (options.connectionType === UD3ConnectionType.udp_min) {
        newOptions.udpOptions = options.options;
    } else {
        newOptions.serialOptions = options.options;
    }
    setUIConfig({lastConnectOptions: newOptions});
}

export function getDefaultVolumes(mediaFile: string): SavedMixerState {
    return getUIConfig().mixerStateBySong[mediaFile] || {
        channelPrograms: [],
        coilSettings: {},
        masterSettings: DEFAULT_COIL_MIXER_STATE,
    };
}

const DEFAULT_COIL_MIXER_STATE: CoilMixerState = {
    channelSettings: [],
    masterSetting: {},
};

function updateVolume(
    channel: number | undefined, oldSettings: Partial<CoilMixerState> | undefined, update: VolumeUpdate,
): CoilMixerState {
    if (!oldSettings) {
        oldSettings = {};
    }
    if (channel === undefined) {
        return {
            channelSettings: oldSettings.channelSettings || [],
            masterSetting: {...oldSettings.masterSetting, ...update},
        };
    } else {
        const newChannels = [...(oldSettings.channelSettings || [])];
        const oldSetting = newChannels[channel] || {};
        newChannels[channel] = {...oldSetting, ...update};
        return {
            channelSettings: newChannels,
            masterSetting: oldSettings.masterSetting || {},
        };
    }
}

export function updateDefaultVolumes(mediaFile: string, key: VolumeKey, update: VolumeUpdate) {
    if (!mediaFile) {
        return;
    }
    const newDefaults: SavedMixerState = {...getDefaultVolumes(mediaFile)};
    if (key.coil === undefined) {
        newDefaults.masterSettings = updateVolume(key.channel, newDefaults.masterSettings, update);
    } else {
        const coilName = getOptionalUD3Connection(key.coil)?.getUDName();
        if (coilName) {
            newDefaults.coilSettings[coilName] = updateVolume(key.channel, newDefaults.coilSettings[coilName], update);
        }
    }
    uiConfig.mixerStateBySong[mediaFile] = newDefaults;
    // TODO save less aggressively (1 / second?)
    saveConfig();
}

export function updateDefaultProgram(mediaFile: string, channel: ChannelID, programID: number) {
    if (!mediaFile) {
        return;
    }
    const programName = getUIConfig().syncedConfig.midiPrograms[programID];
    if (programName !== undefined) {
        const newDefaults: SavedMixerState = {...getDefaultVolumes(mediaFile)};
        newDefaults.channelPrograms = [...newDefaults.channelPrograms];
        newDefaults.channelPrograms[channel] = programName;
        uiConfig.mixerStateBySong[mediaFile] = newDefaults;
        saveConfig();
    }
}
