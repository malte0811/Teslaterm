import * as MidiPlayer from "midi-player-js";
import {CoilID} from "../../common/constants";
import {ChannelID} from "../../common/IPCConstantsToRenderer";
import {MediaFileType, PlayerActivity} from "../../common/MediaTypes";
import {forEachCoilAsync, getConnectionState, isMulticoil} from "../connection/connection";
import {Connected} from "../connection/state/Connected";
import {ipcs} from "../ipc/IPCProvider";
import {checkTransientDisabled, media_state} from "../media/media_player";
import * as scripting from "../scripting";
import {getUIConfig} from "../UIConfigHandler";
import {maybeRedirectEvent} from "./MidiRedirector";

export const kill_msg = Buffer.of(0xB0, 0x78, 0x00);
export const VOLUME_CC_KEY = 7;

// Initialize player and register event handler
export const player = new MidiPlayer.Player(
    ev => processMidiFromPlayer(ev).catch(err => console.error("playing MIDI", err)),
);

export async function startCurrentMidiFile() {
    if (isMulticoil() && getUIConfig().syncedConfig.showmodeOptions.skipInitialSilence) {
        let firstNoteOn = Infinity;
        for (const track of player.tracks) {
            for (const event of track.events) {
                if (event.tick >= firstNoteOn) {
                    break;
                }
                if (event.name === 'Note on') {
                    firstNoteOn = event.tick;
                }
            }
        }
        const earlyEvents: MidiPlayer.Event[] = [];
        for (const track of player.tracks) {
            for (const event of track.events) {
                if (event.tick >= firstNoteOn) {
                    break;
                }
                earlyEvents.push(event);
            }
        }
        earlyEvents.sort((e1, e2) => e1.tick - e2.tick);
        for (const event of earlyEvents) {
            await processMidiFromPlayer(event);
            if (event.name === 'Set Tempo') {
                console.log(JSON.stringify(event));
                player.tempo = event.data;
                // This is a private member, we cannot set it in another way
                // tslint:disable-next-line:no-string-literal
                player['defaultTempo'] = event.data;
            }
        }
        player.skipToTick(firstNoteOn);
    }
    player.play();
    ipcs.misc.updateMediaInfo();
}

export function stopMidiFile() {
    player.stop();
    stopMidiOutput();
    scripting.onMediaStopped();
}

export function stopMidiOutput() {
    playMidiData(kill_msg).catch(err => console.error("Stopping MIDI output", err));
}

async function processMidiFromPlayer(event: MidiPlayer.Event) {
    if (await playMidiEvent(event)) {
        media_state.progress = 100 - player.getSongPercentRemaining();
    }
    ipcs.misc.updateMediaInfo();
}

const expectedByteCounts = {
    0x8: 3,
    0x9: 3,
    0xA: 3,
    0xB: 3,
    0xC: 2,
    0xD: 2,
    0xE: 3,
};

function getVarIntLength(byteArray: Uint8Array, startByte: number) {
    let currentByte = byteArray[startByte];
    let byteCount = 1;

    while (currentByte >= 128) {
        currentByte = byteArray[startByte + byteCount];
        byteCount++;
    }

    return byteCount;
}

let received_event = false;

export function sendProgramChange(voice: ChannelID, program: number) {
    return playMidiData([0xc0 | (voice - 1), program]);
}

export function sendVolume(coil: CoilID, voice: ChannelID, volumePercent: number) {
    return playMidiDataOn(
        coil,
        [
            // Controller change command
            0xb0 | (voice - 1),
            // Volume change
            VOLUME_CC_KEY,
            // Actual volume (0-127)
            volumePercent * 127 / 100,
        ],
    );
}

const lastStatusByTrack = new Map<number, number>();

export async function playMidiEvent(event: MidiPlayer.Event): Promise<boolean> {
    received_event = true;

    const trackObj = player.tracks[event.track - 1];
    // tslint:disable-next-line:no-string-literal
    const track: Uint8Array = trackObj["data"];
    const startIndex = event.byteIndex + getVarIntLength(track, event.byteIndex);
    const firstByte = track[startIndex];
    let argsStartIndex = startIndex;
    if (firstByte >= 0x80) {
        // If the first byte is less than 0x80, the MIDI file is using the "running status" feature where the first byte
        // of a message can be skipped if it is the same as in the previous message.
        lastStatusByTrack.set(event.track, firstByte);
        ++argsStartIndex;
    }
    const data: number[] = [lastStatusByTrack.get(event.track)];
    const len = expectedByteCounts[data[0] >> 4];
    if (!len) {
        return true;
    }
    for (let i = 0; i < len - 1; ++i) {
        data.push(track[argsStartIndex + i]);
    }
    if (await maybeRedirectEvent(event)) {
        return true;
    } else {
        return playMidiData(data);
    }
}

async function playMidiDataOn(coil: CoilID, data: number[] | Uint8Array) {
    await checkTransientDisabled(coil);
    const connectionState = getConnectionState(coil);
    if (connectionState instanceof Connected) {
        await connectionState.sendMIDI(Buffer.from(data));
    }
}

export async function playMidiData(data: number[] | Uint8Array): Promise<boolean> {
    if (data[0] !== 0x00) {
        await forEachCoilAsync(async (coil) => playMidiDataOn(coil, data));
        return true;
    } else {
        return false;
    }
}

export function update(): void {
    // The MIDI player never outputs multiple events at the same time (always at least 5 ms between). This can result
    // in tones that should start at once starting with a noticeable delay if the main loop runs between the 2 events.
    // This loop forces the MIDI player to output all events that should have played before now
    // It is not necessary to reset received_event before the loop since it isn't necessary to run the loop if no events
    // were processed since the last tick
    if (player.isPlaying()) {
        let i = 0;
        while (received_event && i < 20) {
            ++i;
            received_event = false;
            player.playLoop(false);
        }
    } else if (media_state.state === PlayerActivity.playing && media_state.type === MediaFileType.midi) {
        media_state.stopPlaying();
    }
}
