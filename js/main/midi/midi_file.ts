import {MidiData} from "midi-file";
import * as MidiManager from "midi-file";
import {DroppedFile} from "../../common/IPCConstantsToMain";
import {ChannelID, ToastSeverity} from "../../common/IPCConstantsToRenderer";
import {MediaFileType} from "../../common/MediaTypes";
import {getMixer, isMulticoil} from "../connection/connection";
import {ipcs} from "../ipc/IPCProvider";
import {media_state} from "../media/media_player";
import {MixerState} from "../media/mixer/MixerState";
import {startCurrentMidiFile, stopMidiFile} from "./MidiComms";
import {VOLUME_CC_KEY} from "./MidiMessages";

export let currentMidiFile: MidiData;

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

function updateMixer(mixer: MixerState) {
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
    const nameByChannel = new Map<ChannelID, string>();
    for (const [channel, track] of trackByChannel) {
        nameByChannel.set(channel, nameByTrack.get(track) || `Channel ${channel}`);
    }
    uniqueChannels.sort((a, b) => a - b);
    mixer.resetBeforeSongLoad();
    mixer.setProgramsByVoice(programByChannel);
    mixer.setChannelNames(nameByChannel);
    mixer.setChannels(uniqueChannels);
    uniqueChannels.forEach((channel) => {
        if (volumeByChannel.has(channel)) {
            mixer.updateVolume({channel}, {
                muted: false,
                volumePercent: volumeByChannel.get(channel),
            }, false);
        }
    });
}

export async function loadMidiFile(file: DroppedFile) {
    currentMidiFile = MidiManager.parseMidi(new Uint8Array(file.bytes));
    const mixer = getMixer();
    if (mixer) {
        updateMixer(mixer);
    }
    ipcs.misc.updateMediaInfo();
    await media_state.loadFile(
        file,
        MediaFileType.midi,
        file.name.substring(0, file.name.length - 4),
        startCurrentMidiFile,
        stopMidiFile,
    );
}
