import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER, VoiceID} from "../../common/IPCConstantsToRenderer";
import {sendProgramChange} from "../midi/midi";
import {getUIConfig} from "../UIConfig";
import {MainIPC} from "./IPCProvider";

export class MixerIPC {
    private voices: number[] = [0, 1, 2];
    private programByVoice: Map<VoiceID, number> = new Map<VoiceID, number>();
    private readonly processIPC: MainIPC;

    constructor(processIPC: MainIPC) {
        this.processIPC = processIPC;
        processIPC.onAsync(IPC_CONSTANTS_TO_MAIN.centralTab.setMIDIProgramOverride, async ([channel, program]) => {
            this.programByVoice.set(channel, program);
            await sendProgramChange(channel, program);
        });
    }

    public getProgramFor(channel: VoiceID) {
        return this.programByVoice.get(channel);
    }

    public setVoices(voices: number[]) {
        this.voices = voices;
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setMediaChannels, this.voices);
    }

    public setProgramsByVoice(programByVoice: Map<VoiceID, number>) {
        this.programByVoice = programByVoice;
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setMIDIProgramsByChannel, this.programByVoice);
    }

    public sendFullState() {
        this.setVoices(this.voices);
        this.setProgramsByVoice(this.programByVoice);
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setAvailableMIDIPrograms, getUIConfig().midiPrograms);
    }
}
