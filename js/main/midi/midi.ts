import * as MidiPlayer from "midi-player-js";
import * as rtpmidi from "rtpmidi";
import {MediaFileType, PlayerActivity, SynthType} from "../../common/CommonTypes";
import {getUD3Connection, hasUD3Connection} from "../connection/connection";
import {commandServer, config, simulated} from "../init";
import {ipcs} from "../ipc/IPCProvider";
import {checkTransientDisabled, media_state} from "../media/media_player";
import * as scripting from "../scripting";

export const kill_msg = Buffer.of(0xB0, 0x77, 0x00);

// Initialize player and register event handler
export const player = new MidiPlayer.Player(processMidiFromPlayer);

export async function startCurrentMidiFile() {
    player.play();
    ipcs.scope.updateMediaInfo();
}

export function stopMidiFile() {
    player.stop();
    ipcs.scope.drawChart();
    stopMidiOutput();
    scripting.onMediaStopped();
}

export function stopMidiOutput() {
    playMidiData(kill_msg);
}

function processMidiFromPlayer(event: MidiPlayer.Event) {
    if (playMidiEvent(event)) {
        media_state.progress = 100 - player.getSongPercentRemaining();
    } else if (!simulated && !hasUD3Connection()) {
        stopMidiFile();
    }
    ipcs.scope.updateMediaInfo();
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

function getVarIntLength(byteArray, base) {
    let currentByte = byteArray[base];
    let byteCount = 1;

    while (currentByte >= 128) {
        currentByte = byteArray[base + byteCount];
        byteCount++;
    }

    return byteCount;
}

let received_event = false;

export function playMidiEvent(event: MidiPlayer.Event): boolean {
    received_event = true;
    const trackObj = player.tracks[event.track - 1];
    // tslint:disable-next-line:no-string-literal
    const track: number[] = trackObj["data"];
    const startIndex = event.byteIndex + getVarIntLength(track, event.byteIndex);
    const data: number[] = [track[startIndex]];
    const len = expectedByteCounts[data[0] >> 4];
    if (!len) {
        return true;
    }
    for (let i = 1; i < len; ++i) {
        data.push(track[startIndex + i]);
    }
    return playMidiData(data);
}

export function playMidiData(data: number[] | Uint8Array): boolean {
    if (hasUD3Connection() && data[0] !== 0x00) {
        const msg = Buffer.from(data);
        const connection = getUD3Connection();
        checkTransientDisabled();
        connection.sendMidi(msg);
        connection.setSynth(SynthType.MIDI, true);
        if (commandServer) {
            commandServer.sendMIDI(msg);
        }
        return true;
    } else {
        return simulated && data[0] !== 0;
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

export function init() {
    if (config.midi.runMidiServer) {
        const session = rtpmidi.manager.createSession({
            localName: config.midi.localName,
            bonjourName: config.midi.bonjourName,
            port: config.midi.port,
        });
        session.on("message", async (delta, data) => {
            if (hasUD3Connection()) {
                await getUD3Connection().setSynth(SynthType.MIDI, true);
                if (media_state.state === PlayerActivity.playing) {
                    media_state.stopPlaying();
                }
                playMidiData(data);
            }
        });
    }
}
