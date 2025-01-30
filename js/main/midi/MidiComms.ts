import {MidiEvent} from "midi-file";
import {CoilID} from "../../common/constants";
import {ChannelID} from "../../common/IPCConstantsToRenderer";
import {PlayerActivity} from "../../common/MediaTypes";
import {forEachCoilAsync, getConnectionState, isMulticoil} from "../connection/connection";
import {Connected} from "../connection/state/Connected";
import {ipcs} from "../ipc/IPCProvider";
import {checkTransientDisabled, media_state} from "../media/media_player";
import * as scripting from "../scripting";
import {getUIConfig} from "../UIConfigHandler";
import {currentMidiFile} from "./midi_file";
import {ALL_SOUND_OFF_CC_KEY, buildControllerMessage, eventToWireBytes, VOLUME_CC_KEY} from "./MidiMessages";
import {MidiPlayer} from "./MidiPlayer";
import {maybeRedirectEvent} from "./MidiRedirector";

export let activeMidiPlayer: MidiPlayer;

export async function startCurrentMidiFile() {
    activeMidiPlayer = new MidiPlayer(
        currentMidiFile,
        isMulticoil() && getUIConfig().syncedConfig.showmodeOptions.skipInitialSilence,
        (ev) => processMidiFromPlayer(ev).catch(err => console.error("playing MIDI", err)),
        () => {
            if (media_state.state === PlayerActivity.playing) {
                media_state.stopPlaying();
            }
        },
    );
    activeMidiPlayer.start();
    ipcs.misc.updateMediaInfo();
}

export function stopMidiFile() {
    activeMidiPlayer.stop();
    stopMidiOutput();
    scripting.onMediaStopped();
}

export function stopMidiOutput() {
    playMidiMessage(buildControllerMessage(ALL_SOUND_OFF_CC_KEY, 0, 0))
        .catch(err => console.error("Stopping MIDI output", err));
}

async function processMidiFromPlayer(event: MidiEvent) {
    await playMidiEvent(event);
    media_state.progress = Math.round(100 * activeMidiPlayer.estimatePlayedFraction());
    ipcs.misc.updateMediaInfo();
}

export function sendProgramChange(voice: ChannelID, program: number) {
    return playMidiMessage({
        channel: voice,
        deltaTime: 0,
        programNumber: program,
        type: 'programChange',
    });
}

export function sendVolume(coil: CoilID, voice: ChannelID, volumePercent: number) {
    return playMidiMessage(
        buildControllerMessage(VOLUME_CC_KEY, volumePercent * 127 / 100, voice), coil,
    );
}

export async function playMidiEvent(event: MidiEvent) {
    if (!await maybeRedirectEvent(event)) {
        await playMidiMessage(event);
    }
}

async function playMidiDataOn(coil: CoilID, data: number[] | Uint8Array) {
    await checkTransientDisabled(coil);
    const connectionState = getConnectionState(coil);
    if (connectionState instanceof Connected) {
        await connectionState.sendMIDI(Buffer.from(data));
    }
}

export async function playMidiMessage(message: MidiEvent, coil?: CoilID) {
    const data = eventToWireBytes(message);
    if (data !== undefined) {
        if (coil !== undefined) {
            await playMidiDataOn(coil, data);
        } else {
            await playMidiData(data);
        }
    }
}

export async function playMidiData(data: number[] | Uint8Array) {
    await forEachCoilAsync(async (coil) => playMidiDataOn(coil, data));
}
