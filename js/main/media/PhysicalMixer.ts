import {manager, Session} from "rtpmidi";
import {PhysicalMixerConfig} from "../../common/Options";
import {MixerLayer} from "../../common/VolumeMap";
import {getCoils} from "../connection/connection";
import {ipcs} from "../ipc/IPCProvider";

// MIDI standard would be -8192 to 8191, but this is easier for this application
const FADER_MAX = 16383;
const PERCENT_MAX = 100;
const PITCH_BEND_SIGNATURE = 0xb0;
const NOTE_ON_SIGNATURE = 0x90;
const PREV_BANK_KEY = 46;
const NEXT_BANK_NOTE = 47;

function buildPitchBendMessage(midiChannel: number, pitch: number) {
    return [PITCH_BEND_SIGNATURE | midiChannel, pitch & 0x7f, pitch >> 7];
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

function decodeNoteOn(data: number[]) {
    if (data.length !== 3 || (data[0] & 0xf0) !== NOTE_ON_SIGNATURE) {
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

    constructor(config: PhysicalMixerConfig) {
        this.session = manager.createSession({
            bonjourName: 'Teslaterm to XTouch',
            localName: 'Teslaterm to XTouch',
            port: 5004,
        });
        this.session.on("message", async (delta, data) => {
            const asPitchBend = decodePitchBend(data);
            if (asPitchBend) {
                ipcs.mixer.setVolumeFromPhysical(asPitchBend.channel - 1, faderToPercent(asPitchBend.value));
            }
            const asNoteOn = decodeNoteOn(data);
            if (asNoteOn) {
                const layers: MixerLayer[] = ['coilMaster', 'voiceMaster', ...getCoils()];
                const currentIndex = layers.indexOf(ipcs.mixer.getCurrentLayer());
                if (asNoteOn.key === PREV_BANK_KEY && currentIndex > 0) {
                    ipcs.mixer.setLayerFromPhysical(layers[currentIndex - 1]);
                } else if (asNoteOn.key === NEXT_BANK_NOTE && currentIndex < layers.length - 1) {
                    ipcs.mixer.setLayerFromPhysical(layers[currentIndex + 1]);
                }
            }
        });
        this.session.connect({port: config.port, address: config.ip});
    }

    public movePhysicalSlider(slider: number, percent: number) {
        const pitch = percentToFader(percent);
        const message = buildPitchBendMessage(slider + 1, pitch);
        this.session.sendMessage(0, message);
    }

    public movePhysicalSliders(values: Map<number, number>) {
        for (const [key, value] of values.entries()) {
            this.movePhysicalSlider(key, value);
        }
    }

    public close() {
        this.session.end();
    }
}
