import {CoilID} from "../../common/constants";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER, VoiceID} from "../../common/IPCConstantsToRenderer";
import {DEFAULT_MIXER_LAYER, MixerLayer, NUM_SPECIFIC_FADERS, VolumeKey, VolumeMap} from "../../common/VolumeMap";
import {forEachCoilAsync, getPhysicalMixer} from "../connection/connection";
import {sendProgramChange, sendVolume} from "../midi/midi";
import {getUIConfig} from "../UIConfigHandler";
import {MainIPC} from "./IPCProvider";

export class MixerIPC {
    private voices: number[] = [0, 1, 2];
    private programByVoice: Map<VoiceID, number> = new Map<VoiceID, number>();
    private volumes: VolumeMap = new VolumeMap();
    private currentLayer: MixerLayer = DEFAULT_MIXER_LAYER;
    private readonly processIPC: MainIPC;

    constructor(processIPC: MainIPC) {
        this.processIPC = processIPC;
        processIPC.onAsync(IPC_CONSTANTS_TO_MAIN.centralTab.setMIDIProgramOverride, async ([channel, program]) => {
            this.programByVoice.set(channel, program);
            await sendProgramChange(channel, program);
        });
        processIPC.onAsync(IPC_CONSTANTS_TO_MAIN.centralTab.setMixerLayer, async (layer) => {
            this.currentLayer = layer;
            getPhysicalMixer()?.movePhysicalSliders(this.volumes.getFaderStates(this.currentLayer));
        });
        processIPC.onAsync(IPC_CONSTANTS_TO_MAIN.centralTab.setVolume, async ([key, volume]) => {
            this.volumes = this.volumes.with(key, volume);
            await this.sendVolumeUpdates(key);
            getPhysicalMixer()?.movePhysicalSlider(this.volumes.getFaderID(key), volume);
        });
    }

    public getProgramFor(channel: VoiceID) {
        return this.programByVoice.get(channel);
    }

    public setVoices(voices: number[]) {
        this.voices = voices;
        this.volumes = this.volumes.withoutVoiceVolumes();
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setMediaChannels, this.voices);
    }

    public setProgramsByVoice(programByVoice: Map<VoiceID, number>) {
        this.programByVoice = programByVoice;
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setMIDIProgramsByChannel, this.programByVoice);
    }

    public sendAvailablePrograms() {
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setAvailableMIDIPrograms, getUIConfig().midiPrograms);
    }

    public sendFullState() {
        this.setVoices(this.voices);
        this.setProgramsByVoice(this.programByVoice);
        this.sendAvailablePrograms();
    }

    public setVolumeFromPhysical(fader: number, percent: number) {
        const key: VolumeKey = (() => {
            if (fader >= NUM_SPECIFIC_FADERS) {
                return {};
            } else if (this.currentLayer === 'voiceMaster') {
                return {voice: fader};
            } else if (this.currentLayer === 'coilMaster') {
                return {coil: fader};
            } else {
                return {coil: this.currentLayer, voice: fader};
            }
        })();
        this.volumes = this.volumes.with(key, percent);
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setVolume, [key, percent]);
        this.sendVolumeUpdates(key).catch((err) => console.error("Failed to send volume update:", err));
    }

    public setLayerFromPhysical(layer: MixerLayer) {
        this.currentLayer = layer;
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setMixerLayer, layer);
    }

    public getCurrentLayer() {
        return this.currentLayer;
    }

    private async sendVolumeUpdates(changedKey: VolumeKey) {
        const sendUpdate = async (coil: CoilID, voice: VoiceID) => {
            await sendVolume(coil, voice, this.volumes.getTotalVolume(coil, voice));
        };
        const sendUpdatesToCoil = async (coil: CoilID) => {
            if (changedKey.voice) {
                await sendUpdate(coil, changedKey.voice);
            } else {
                await Promise.all(this.voices.map((voice) => sendUpdate(coil, voice)));
            }
        };
        if (changedKey.coil) {
            await sendUpdatesToCoil(changedKey.coil);
        } else {
            await forEachCoilAsync(sendUpdatesToCoil);
        }
    }
}
