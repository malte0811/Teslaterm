import fs from "fs";
import {MidiData, MidiTextEvent, parseMidi, writeMidi} from "midi-file";
import {DroppedFile} from "../../common/IPCConstantsToMain";
import {ChannelID, ToastSeverity} from "../../common/IPCConstantsToRenderer";
import {MediaFileType} from "../../common/MediaTypes";
import {VolumeSetting} from "../../common/MixerTypes";
import {SavedMixerState} from "../../common/UIConfig";
import {isMulticoil} from "../connection/connection";
import {ipcs} from "../ipc/IPCProvider";
import {LoadedMixerState, media_state} from "../media/media_player";
import {getDefaultVolumes, getUIConfig} from "../UIConfigHandler";
import {startCurrentMidiFile, stopMidiFile} from "./MidiComms";
import {VOLUME_CC_KEY} from "./MidiMessages";

export let currentMidiFile: MidiData;
let currentMidiSource: string;

interface MIDIStoredMixerState {
    channelVolumes: Array<Partial<VolumeSetting>>;
    masterVolume: Partial<VolumeSetting>;
    channelPrograms: string[];
}

const META_PREFIX = 'ud3_teslaterm__';

export function guessMicrosecondsPerQuarter(data: MidiData) {
    for (const track of data.tracks) {
        for (const event of track) {
            if (event.type === 'setTempo') {
                return event.microsecondsPerBeat;
            }
        }
    }
    return undefined;
}

function findStoredMixerData(data: MidiData) {
    for (const track of data.tracks) {
        for (const event of track) {
            if (event.type === 'text' && event.text.startsWith(META_PREFIX)) {
                return event;
            }
        }
    }
    return undefined;
}

function getStoredMixerData(data: MidiData) {
    const event = findStoredMixerData(data);
    if (event !== undefined) {
        try {
            const json_string = event.text.substring(META_PREFIX.length);
            const json_data = JSON.parse(json_string);
            return json_data as MIDIStoredMixerState;
        } catch (e) {
            console.error('Parsing TT meta message', e);
        }
    }
    return undefined;
}

function addStoredMixerData(originalData: MidiData, stateToStore: MIDIStoredMixerState) {
    const modifiedData = structuredClone(originalData);
    let storedEvent: MidiTextEvent = findStoredMixerData(modifiedData);
    if (storedEvent === undefined) {
        storedEvent = {deltaTime: 0, text: '', type: 'text'};
        modifiedData.tracks[0].unshift(storedEvent);
    }
    storedEvent.text = META_PREFIX + JSON.stringify(stateToStore);
    return modifiedData;
}

function addValue<K, T>(map: Map<K, T[]>, key: K, value: T) {
    if (!map.has(key)) {
        map.set(key, []);
    }
    const values = map.get(key);
    if (!values.includes(value)) {
        values.push(value);
    }
}

function warnAndCleanMultivalues<K, T>(map: Map<K, T[]>, message: (key: K, count: number) => string) {
    const result = new Map<K, T>();
    let anyBad = false;
    for (const [key, value] of map) {
        if (value.length === 1) {
            result.set(key, value[0]);
        } else {
            console.warn(message(key, value.length));
            anyBad = true;
        }
    }
    if (anyBad && isMulticoil()) {
        ipcs.misc.openGenericToast(
            'MIDI error',
            'Inconsistent MIDI data found, mixer may not work as expected',
            ToastSeverity.warning,
            'inconsistent-midi',
        );
    }
    return result;
}

export async function writeMidiWithMixerState() {
    if (!currentMidiSource) {
        return;
    }
    const mixerData = getDefaultVolumes(media_state.title);
    const withMixer = addStoredMixerData(currentMidiFile, {
        channelPrograms: mixerData.channelPrograms,
        channelVolumes: mixerData.masterSettings.channelSettings,
        masterVolume: mixerData.masterSettings.masterSetting,
    });
    const newBytes = writeMidi(withMixer);
    // TODO create backup? Or at least some sort of "parse again" failsafe mechanism?
    await fs.promises.writeFile(currentMidiSource, Buffer.from(newBytes));
}

function applyMixerStateFromMIDI(state: SavedMixerState, midi: MidiData) {
    const midiData = getStoredMixerData(midi);
    if (!midiData) {
        return;
    }
    midiData.channelPrograms.forEach((program, channel) => {
        if (program) {
            state.channelPrograms[channel] = program;
        }
    });
    const masterState = state.masterSettings;
    masterState.masterSetting = {
        ...masterState.masterSetting,
        ...midiData.masterVolume,
    };
    midiData.channelVolumes.forEach((settings, channel) => {
        if (settings) {
            masterState.channelSettings[channel] = {
                ...(masterState.channelSettings[channel] || {}),
                ...settings,
            };
        }
    });
}

function updateMixerState(mixer: SavedMixerState): LoadedMixerState {
    // TODO which data should have priority over what? Also probably add a reset button
    try {
        applyMixerStateFromMIDI(mixer, currentMidiFile);
    } catch (e) {
        console.error("While loading mixer state from MIDI", e);
        ipcs.misc.openGenericToast(
            'MIDI mixer data',
            'Failed to load stored mixer state from MIDI',
            ToastSeverity.error,
            'mixer-data-load-fail',
        );
    }
    const uniqueChannels: number[] = [];
    const programsByChannel = new Map<ChannelID, number[]>();
    const volumesByChannel = new Map<ChannelID, number[]>();
    const namesByTrack = new Map<number, string[]>();
    const tracksByChannel = new Map<ChannelID, number[]>();
    currentMidiFile.tracks.forEach((track, trackArrayIndex) => {
        for (const event of track) {
            if (event.type === 'trackName') {
                // TODO +1 on track idx?
                addValue(namesByTrack, trackArrayIndex, event.text);
            }
            if ('channel' in event) {
                if (!uniqueChannels.includes(event.channel)) {
                    uniqueChannels.push(event.channel);
                }
                // TODO ditto on idx
                addValue(tracksByChannel, event.channel, trackArrayIndex);
            }
            if (event.type === 'programChange') {
                addValue(programsByChannel, event.channel, event.programNumber);
            } else if (event.type === 'controller' && event.controllerType === VOLUME_CC_KEY) {
                addValue(volumesByChannel, event.channel, event.value * (100 / 127));
            }
        }
    });
    const nameByTrack = warnAndCleanMultivalues(namesByTrack, (t, n) => `Have ${n} names for track ${t}`);
    const trackByChannel = warnAndCleanMultivalues(tracksByChannel, (k, n) => `${n} tracks access channel ${k}`);
    const programByChannel = warnAndCleanMultivalues(programsByChannel, (k, n) => `Channel ${k} has ${n} programs`);
    const volumeByChannel = warnAndCleanMultivalues(volumesByChannel, (k, n) => `Channel ${k} has ${n} preset volumes`);
    uniqueChannels.sort((a, b) => a - b);

    const result: LoadedMixerState = {
        channels: uniqueChannels.map((id) => ({
            id,
            name: trackByChannel.has(id) ? nameByTrack.get(trackByChannel.get(id)) : undefined,
        })),
        faders: mixer,
    };
    const fallbackProgram = getUIConfig().syncedConfig.midiPrograms[0];
    for (const [channel, program] of programByChannel.entries()) {
        const name = getUIConfig().syncedConfig.midiPrograms[program];
        result.faders.channelPrograms[channel] ||= name || fallbackProgram;
    }
    for (const [channel, volume] of volumeByChannel.entries()) {
        const oldSettings = result.faders.masterSettings.channelSettings[channel] || {};
        if (!('volumePercent' in oldSettings)) {
            result.faders.masterSettings.channelSettings[channel] = {
                volumePercent: volume * 100 / 127,
                ...oldSettings,
            };
        }
    }
    return result;
}

export async function loadMidiFile(file: DroppedFile) {
    currentMidiFile = parseMidi(file.bytes);
    currentMidiSource = file.path;
    ipcs.misc.updateMediaInfo();
    await media_state.loadFile(
        file,
        MediaFileType.midi,
        file.name.substring(0, file.name.length - 4),
        startCurrentMidiFile,
        stopMidiFile,
        updateMixerState,
    );
}

export function clearMidiFile() {
    currentMidiFile = undefined;
    currentMidiSource = undefined;
}
