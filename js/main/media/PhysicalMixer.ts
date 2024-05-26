import {manager, Session} from "rtpmidi";
import {PlayerActivity} from "../../common/MediaTypes";
import {AllFaders, MixerLayer} from "../../common/MixerTypes";
import {PhysicalMixerConfig} from "../../common/Options";
import {getCoils} from "../connection/connection";
import {ipcs} from "../ipc/IPCProvider";
import {media_state} from "./media_player";
import {NUM_SPECIFIC_FADERS} from "./VolumeMap";

// MIDI standard would be -8192 to 8191, but this is easier for this application
const FADER_MAX = 16383;
const PERCENT_MAX = 100;
const PITCH_BEND_SIGNATURE = 0xe0;
const CONTROL_CHANGE_SIGNATURE = 0xb0;
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
    // Index is MIDI note used to trigger the button
    private readonly lastButtonStates = new Map<number, boolean>();
    private readonly mediaUpdateCallback: (state: PlayerActivity) => any;

    constructor(config: PhysicalMixerConfig) {
        this.config = config;
        this.session = manager.createSession({
            bonjourName: 'Teslaterm to XTouch',
            localName: 'Teslaterm to XTouch',
            port: 5005,
        });
        this.session.bundle = false;
        this.session.on('message', async (delta, data) => {
            const asPitchBend = decodePitchBend(data);
            const asButtonPress = decodeButtonPress(data);
            if (asPitchBend) {
                const volumePercent = faderToPercent(asPitchBend.value);
                ipcs.mixer.setVolumeFromPhysical(asPitchBend.channel, {volumePercent});
            } else if (asButtonPress) {
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
                    ipcs.mixer.setVolumeFromPhysical(fader, {muted: !this.lastButtonStates.get(asButtonPress.key)});
                } else if (asButtonPress.key === PREV_SONG_NOTE) {
                    ipcs.mixer.cycleMediaFile(false);
                } else if (asButtonPress.key === NEXT_SONG_NOTE) {
                    ipcs.mixer.cycleMediaFile(true);
                }
            } else {
                const hex = data.map((i) => i.toString(16)).join(' ');
                console.log("got unknown message from Behringer: \"" + hex + "\"");
            }
        });
        this.session.on('controlMessage', () => this.lastMessageTime = Date.now());
        this.lastMessageTime = Date.now();
        this.reconnectTimer = setInterval(() => this.checkReconnect(), 1_000);
        this.mediaUpdateCallback = (state) => {
            this.setButton(STOP_NOTE, state === PlayerActivity.idle);
            this.setButton(PLAY_NOTE, state === PlayerActivity.playing);
        };
        media_state.addUpdateCallback(this.mediaUpdateCallback);
        this.session.on('streamAdded', () => setTimeout(() => {
            ipcs.mixer.updatePhysicalMixer();
            this.mediaUpdateCallback(media_state.state);
        }, 100));
        this.connect();
    }

    public close() {
        this.session.end();
        clearInterval(this.reconnectTimer);
        media_state.removeUpdateCallback(this.mediaUpdateCallback);
    }

    public movePhysicalSliders(allFaders: AllFaders) {
        const physicalFaders = allFaders.specificFaders.map((data) => data?.volume);
        while (physicalFaders.length < NUM_SPECIFIC_FADERS) {
            physicalFaders.push(undefined);
        }
        physicalFaders.length = NUM_SPECIFIC_FADERS;
        physicalFaders.push({muted: false, volumePercent: allFaders.masterVolumePercent});
        physicalFaders.forEach((state, i) => {
            // TODO also mark disabled channels somewhere else?
            const value = state ? state : {muted: true, volumePercent: 0};
            if (value.volumePercent !== this.lastFaderState[i]) {
                const pitch = percentToFader(value.volumePercent);
                this.session.sendMessage(0, buildPitchBendMessage(i, pitch));
                this.lastFaderState[i] = value.volumePercent;
            }
            const muteNote = FIRST_MUTE_NOTE + i;
            if (muteNote <= LAST_MUTE_NOTE) {
                this.setButton(muteNote, value.muted);
            }
        });
    }

    public updateLayer(currentLayer: MixerLayer) {
        switch (currentLayer) {
            case 'voiceMaster':
                this.set7SegmentText(0, 'CH');
                break;
            case 'coilMaster':
                this.set7SegmentText(0, 'GC');
                break;
            default:
                this.set7SegmentText(0, 'C' + currentLayer);
                break;
        }
    }

    public set7SegmentText(startDigit: number, value: string) {
        // is there even any data?
        if (value.length === 0) {
            return;
        }

        // go through all chars of the string and send them
        let num: number = startDigit;
        for (let i = 0; i < value.length; i++) {
            const char: string = value[i];

            // is the next digit a dot? If there even is one
            if (i < value.length - 1) {
                if (char === '.') {
                    // yes! skip it and set the value with dotOn = true
                    this.set7SegmentValue(num, char, true);
                    i++;
                } else {
                    // no, just deal with it later
                    this.set7SegmentValue(num, char, false);
                }
            } else {
                // no further character => can't have a dot anyway
                this.set7SegmentValue(num, char, false);
            }

            num++;
        }
    }

    private set7SegmentValue(digit: number, value: string, dotOn: boolean) {
        // is the digit valid? (0-11)
        if (digit > 11) {
            return;
        }

        // is there even any char to display
        if (value.length === 0) {
            return;
        }

        // build midi message

        // digit is adressed 0-12 mapped to 0x4b - 0x40
        const digitId = 0x4b - digit;

        // value selected like this:
        // 0	Dot	ASCII
        // b7	b6	b5	b4	b3	b2	b1	b0
        const controllerValue = (dotOn ? 0x40 : 0) | (value.charCodeAt(0) & 0x3f);

        const message = [CONTROL_CHANGE_SIGNATURE, digitId, controllerValue];
        this.session.sendMessage(0, message);
    }

    private setButton(midiNote: number, light: boolean) {
        if (light !== this.lastButtonStates.get(midiNote)) {
            this.session.sendMessage(0, buildButtonMessage(midiNote, light));
            this.lastButtonStates.set(midiNote, light);
        }
    }

    private checkReconnect() {
        const now = Date.now();
        if (this.lastMessageTime + 6_000 < now) {
            this.lastMessageTime = now;
            this.lastButtonStates.clear();
            this.lastFaderState.length = 0;
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
