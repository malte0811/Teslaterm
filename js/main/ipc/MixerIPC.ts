import {IPC_CONSTANTS_TO_RENDERER} from "../../common/IPCConstantsToRenderer";
import {MainIPC} from "./IPCProvider";

export class MixerIPC {
    private voices: number[] = [0, 1, 2];
    private readonly processIPC: MainIPC;

    constructor(processIPC: MainIPC) {
        this.processIPC = processIPC;
        // TODO prepare infrastructure to send the values to the UD3
    }

    public setVoices(voices: number[]) {
        this.voices = voices;
        this.sendFullState();
    }

    public sendFullState() {
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setMediaChannels, this.voices);
    }
}
