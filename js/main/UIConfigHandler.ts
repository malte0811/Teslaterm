import * as fs from "fs";
import {UD3ConnectionType} from "../common/constants";
import {ChannelID, ConnectionPreset} from "../common/IPCConstantsToRenderer";
import {VolumeChannel, VolumeKey, VolumeUpdate} from "../common/MixerTypes";
import {AdvancedOptions, PhysicalMixerType} from "../common/Options";
import {FullConnectionOptions, UD3ConnectionOptions} from "../common/SingleConnectionOptions";
import {CoilMixerState, FullUIConfig, SavedMixerState, SyncedUIConfig} from "../common/UIConfig";
import {getOptionalUD3Connection} from "./connection/connection";
import {
    DEFAULT_SERIAL_PRODUCT,
    DEFAULT_SERIAL_VENDOR,
    getDefaultSerialPortForConfig,
} from "./connection/types/SerialCommon";
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
        mixerOptions: {type: PhysicalMixerType.none, ip: 'localhost', port: 5004},
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

function fixAdvancedOptions(config: Partial<AdvancedOptions>): AdvancedOptions {
    const defaultConfig = makeDefaultAdvancedOptions();
    const fixed: AdvancedOptions = {...defaultConfig, ...config};
    fixed.mixerOptions = {...defaultConfig.mixerOptions, ...fixed.mixerOptions};
    fixed.midiOptions = {...defaultConfig.midiOptions, ...fixed.midiOptions};
    fixed.netSidOptions = {...defaultConfig.netSidOptions, ...fixed.netSidOptions};
    return fixed;
}

function fixSyncedConfig(object: Partial<SyncedUIConfig>) {
    if (object.connectionPresets === undefined) {
        object.connectionPresets = [];
    }
    object.advancedOptions = fixAdvancedOptions(object.advancedOptions);
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
    if (object.showmodeOptions === undefined) {
        // TODO check if these are OK settings!
        object.showmodeOptions = {
            precount: {
                delayMs: 500,
                enabled: false,
                numBeats: 3,
                ontimePercent: 50,
                volumePercent: 20,
            },
        };
    }
    return object as SyncedUIConfig;
}

function getFileData() {
    let object: Partial<FullUIConfig> = (() => {
        try {
            const json = fs.readFileSync(FILENAME, {encoding: 'utf-8'});
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

let configDirty: boolean = false;

export function saveUIConfigNow() {
    if (configDirty) {
        fs.writeFile(FILENAME, JSON.stringify(getUIConfig(), undefined, 2), () => {});
        configDirty = false;
    }
}

export function getUIConfig() {
    if (!uiConfig) {
        uiConfig = getFileData();
        setInterval(saveUIConfigNow, 5000);
    }
    return uiConfig;
}

export function setUIConfig(newConfig: Partial<SyncedUIConfig>) {
    uiConfig.syncedConfig = {...uiConfig.syncedConfig, ...newConfig};
    configDirty = true;
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
    sidSpecialSettings: {},
};

function updateVolume(
    channel: VolumeChannel | undefined, oldSettings: Partial<CoilMixerState> | undefined, update: VolumeUpdate,
): CoilMixerState {
    if (!oldSettings) {
        oldSettings = {};
    }
    if (channel === undefined) {
        return {
            channelSettings: oldSettings.channelSettings || [],
            masterSetting: {...oldSettings.masterSetting, ...update},
            sidSpecialSettings: oldSettings.sidSpecialSettings,
        };
    } else if (channel === 'sidSpecial') {
        return {
            channelSettings: oldSettings.channelSettings || [],
            masterSetting: {...oldSettings.masterSetting},
            sidSpecialSettings: {...oldSettings.sidSpecialSettings, ...update},
        };
    } else {
        const newChannels = [...(oldSettings.channelSettings || [])];
        const oldSetting = newChannels[channel] || {};
        newChannels[channel] = {...oldSetting, ...update};
        return {
            channelSettings: newChannels,
            masterSetting: oldSettings.masterSetting || {},
            sidSpecialSettings: oldSettings.sidSpecialSettings,
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
    configDirty = true;
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
        configDirty = true;
    }
}
