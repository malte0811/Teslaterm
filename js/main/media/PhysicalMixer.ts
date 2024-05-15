import {manager, Session} from "rtpmidi";
import {ChannelID} from "../../common/IPCConstantsToRenderer";
import {PhysicalMixerConfig} from "../../common/Options";
import {DEFAULT_MIXER_LAYER, MixerLayer, NUM_SPECIFIC_FADERS, VolumeSetting} from "../../common/VolumeMap";
import {getCoils} from "../connection/connection";
import {ipcs} from "../ipc/IPCProvider";
import {now} from "../microtime";
import {media_state} from "./media_player";

// MIDI standard would be -8192 to 8191, but this is easier for this application
const FADER_MAX = 16383;
const PERCENT_MAX = 100;
const PITCH_BEND_SIGNATURE = 0xe0;
const NOTE_ON_SIGNATURE = 0x90;
const PREV_BANK_KEY = 46;
const NEXT_BANK_NOTE = 47;
const STOP_NOTE = 93;
const PLAY_NOTE = 94;
const FIRST_MUTE_NOTE = 16;
const LAST_MUTE_NOTE = 16 + NUM_SPECIFIC_FADERS - 1;
const PREV_SONG_NOTE = 98;
const NEXT_SONG_NOTE = 99;

function buildPitchBendMessage(midiChannel: number, pitch: number) {
    return [PITCH_BEND_SIGNATURE | midiChannel, pitch & 0x7f, pitch >> 7];
}

function buildButtonMessage(note: number, on: boolean) {
    return [NOTE_ON_SIGNATURE, note, on ? 127 : 0];
}

function decodePitchBend(data: number[]) {
    if (data.length !== 3 || (data[0] & 0xf0) !== PITCH_BEND_SIGNATURE) {
        return undefined;
    } else {
        return {
            channel: data[0] & 0xf,
            value: data[1] | (data[2] << 7),
        };
    }
}

function decodeButtonPress(data: number[]) {
    if (data.length !== 3 || (data[0] & 0xf0) !== NOTE_ON_SIGNATURE || data[2] !== 127) {
        return undefined;
    } else {
        return {
            channel: data[0] & 0xf,
            key: data[1],
            velocity: data[2],
        };
    }
}

function faderToPercent(faderValue: number) {
    return faderValue * PERCENT_MAX / FADER_MAX;
}

function percentToFader(percent: number) {
    return percent * FADER_MAX / PERCENT_MAX;
}

export class BehringerXTouch {
    private readonly session: Session;
    private readonly config: PhysicalMixerConfig;
    private readonly reconnectTimer: NodeJS.Timeout;
    private lastMessageTime: number;
    private readonly lastFaderState: number[] = [];
    private readonly lastMuteStates: boolean[] = [];

    constructor(config: PhysicalMixerConfig) {
        this.config = config;
        this.session = manager.createSession({
            bonjourName: 'Teslaterm to XTouch',
            localName: 'Teslaterm to XTouch',
            port: 5005,
        });
        this.session.on('message', async (delta, data) => {
            const asPitchBend = decodePitchBend(data);
            if (asPitchBend) {
                const volumePercent = faderToPercent(asPitchBend.value);
                ipcs.mixer.setVolumeFromPhysical(asPitchBend.channel, {volumePercent});
            }
            const asButtonPress = decodeButtonPress(data);
            if (asButtonPress) {
                const layers: MixerLayer[] = ['coilMaster', 'voiceMaster', ...getCoils()];
                const currentIndex = layers.indexOf(ipcs.mixer.getCurrentLayer());
                if (asButtonPress.key === PREV_BANK_KEY && currentIndex > 0) {
                    ipcs.mixer.setLayer(layers[currentIndex - 1]);
                } else if (asButtonPress.key === NEXT_BANK_NOTE && currentIndex < layers.length - 1) {
                    ipcs.mixer.setLayer(layers[currentIndex + 1]);
                } else if (asButtonPress.key === PLAY_NOTE) {
                    await media_state.startPlaying();
                } else if (asButtonPress.key === STOP_NOTE) {
                    media_state.stopPlaying();
                } else if (asButtonPress.key >= FIRST_MUTE_NOTE && asButtonPress.key <= LAST_MUTE_NOTE) {
                    const fader = asButtonPress.key - FIRST_MUTE_NOTE;
                    ipcs.mixer.setVolumeFromPhysical(fader, {muted: !this.lastMuteStates[fader]});
                } else if (asButtonPress.key === PREV_SONG_NOTE) {
                    ipcs.mixer.cycleMediaFile(false);
                } else if (asButtonPress.key === NEXT_SONG_NOTE) {
                    ipcs.mixer.cycleMediaFile(true);
                }
            }
        });
        this.session.on(
            'streamAdded',
            () => setTimeout(() => ipcs.mixer.setLayer(DEFAULT_MIXER_LAYER), 100),
        );
        this.session.on('controlMessage', () => this.lastMessageTime = Date.now());
        this.connect();
        this.lastMessageTime = Date.now();
        this.reconnectTimer = setInterval(() => this.checkReconnect(), 1_000);
    }

    public movePhysicalSliders(values: Map<number, VolumeSetting>) {
        for (const [fader, value] of values) {
            if (value.volumePercent !== this.lastFaderState[fader]) {
                const pitch = percentToFader(value.volumePercent);
                this.session.sendMessage(0, buildPitchBendMessage(fader, pitch));
                this.lastFaderState[fader] = value.volumePercent;
            }
            if (value.muted !== this.lastMuteStates[fader]) {
                this.session.sendMessage(0, buildButtonMessage(FIRST_MUTE_NOTE + fader, value.muted));
                this.lastMuteStates[fader] = value.muted;
            }
        }
    }

    public close() {
        this.session.end();
        clearInterval(this.reconnectTimer);
    }

    private checkReconnect() {
        const now = Date.now();
        if (this.lastMessageTime + 6_000 < now) {
            this.lastMessageTime = now;
            if (this.session.getStreams().length > 0) {
                this.session.removeStream(this.session.getStreams()[0]);
            }
            this.connect();
        }
    }

    private connect() {
        this.session.connect({port: this.config.port, address: this.config.ip});
    }
}
