import {CoilID} from "../../common/constants";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {ChannelID, IPC_CONSTANTS_TO_RENDERER} from "../../common/IPCConstantsToRenderer";
import {MixerLayer, NUM_SPECIFIC_FADERS, VolumeKey, VolumeMap, VolumeUpdate} from "../../common/VolumeMap";
import {forEachCoilAsync, getPhysicalMixer, numCoils} from "../connection/connection";
import {sendProgramChange, sendVolume} from "../midi/midi";
import {getUIConfig} from "../UIConfigHandler";
import {MainIPC} from "./IPCProvider";

export class MixerIPC {
    private programByVoice: Map<ChannelID, number> = new Map<ChannelID, number>();
    private nameByVoice: Map<ChannelID, string> = new Map<ChannelID, string>();
    private volumes: VolumeMap = new VolumeMap();
    private currentLayer: MixerLayer = 'coilMaster';
    private readonly processIPC: MainIPC;

    constructor(processIPC: MainIPC) {
        this.processIPC = processIPC;
        processIPC.onAsync(IPC_CONSTANTS_TO_MAIN.centralTab.setMIDIProgramOverride, async ([channel, program]) => {
            this.programByVoice.set(channel, program);
            await sendProgramChange(channel, program);
        });
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.centralTab.setMixerLayer,
            async (layer) => this.setLayer(layer),
        );
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.centralTab.setVolume,
            async ([key, volume]) => {
                this.updateVolume(key, volume);
            },
        );
    }

    public getProgramFor(channel: ChannelID) {
        return this.programByVoice.get(channel);
    }

    public setChannels(channelIDs: number[]) {
        this.volumes = this.volumes.withChannelMap(channelIDs);
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setMediaChannels, this.volumes.getChannelMap());
    }

    public setProgramsByVoice(programByVoice: Map<ChannelID, number>) {
        this.programByVoice = programByVoice;
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setMIDIProgramsByChannel, this.programByVoice);
    }

    public setChannelNames(nameByVoice: Map<ChannelID, string>) {
        this.nameByVoice = nameByVoice;
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setMIDIChannelNames, this.nameByVoice);
    }

    public sendAvailablePrograms() {
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setAvailableMIDIPrograms, getUIConfig().midiPrograms);
    }

    public sendFullState() {
        this.setChannels(this.volumes.getChannelMap());
        this.setProgramsByVoice(this.programByVoice);
        this.sendAvailablePrograms();
    }

    public setVolumeFromPhysical(fader: number, update: VolumeUpdate) {
        const channelID = this.volumes.getChannelMap()[fader];
        const key: VolumeKey = (() => {
            if (fader >= NUM_SPECIFIC_FADERS) {
                return {};
            } else if (this.currentLayer === 'voiceMaster') {
                return channelID && {channel: channelID};
            } else if (this.currentLayer === 'coilMaster') {
                return fader < numCoils() && {coil: fader};
            } else {
                return channelID !== undefined ? {coil: this.currentLayer, channel: channelID} : undefined;
            }
        })();
        if (key) {
            this.updateVolume(key, update);
        }
    }

    public updateVolume(key: VolumeKey, update: VolumeUpdate) {
        this.volumes = this.volumes.with(key, update);
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setVolume, [key, update]);
        this.sendVolumeToCoil(key).catch((err) => console.error("Failed to send volume update:", err));
        this.updatePhysicalMixer();
    }

    public getCurrentLayer() {
        return this.currentLayer;
    }

    public setLayer(layer: MixerLayer) {
        this.currentLayer = layer;
        this.updatePhysicalMixer();
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setMixerLayer, layer);
    }

    private updatePhysicalMixer() {
        const faders = this.volumes.getFaderStates(this.currentLayer, numCoils());
        getPhysicalMixer()?.movePhysicalSliders(faders);
    }

    private async sendVolumeToCoil(changedKey: VolumeKey) {
        const sendUpdate = async (coil: CoilID, voice: ChannelID) => {
            await sendVolume(coil, voice, this.volumes.getTotalVolume(coil, voice));
        };
        const sendUpdatesToCoil = async (coil: CoilID) => {
            if (changedKey.channel) {
                await sendUpdate(coil, changedKey.channel);
            } else {
                await Promise.all(this.volumes.getChannelMap().map((voice) => sendUpdate(coil, voice)));
            }
        };
        if (changedKey.coil) {
            await sendUpdatesToCoil(changedKey.coil);
        } else {
            await forEachCoilAsync(sendUpdatesToCoil);
        }
    }
}
