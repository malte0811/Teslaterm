import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER, SongListData} from "../../common/IPCConstantsToRenderer";
import {AllFaders, MixerLayer} from "../../common/MixerTypes";
import {getMixer} from "../connection/connection";
import {MainIPC} from "./IPCProvider";

export class MixerIPC {
    private readonly processIPC: MainIPC;

    constructor(processIPC: MainIPC) {
        this.processIPC = processIPC;
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.centralTab.setMIDIProgramOverride,
            async ([fader, program]) => getMixer()?.setProgramForFader(fader, program),
        );
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.centralTab.setMixerLayer,
            async (layer) => getMixer()?.setLayer(layer),
        );
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.centralTab.setVolume,
            async ([key, volume]) => {
                getMixer()?.updateVolume(key, volume, true);
            },
        );
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.centralTab.setVolume,
            async ([key, volume]) => {
                getMixer()?.updateVolume(key, volume, true);
            },
        );
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.centralTab.switchMediaFile, (choice) => getMixer()?.cycleMediaFile(choice.next),
        );
    }

    public sendSongList(songlist: SongListData) {
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setSongList, songlist);
    }

    public sendMixerLayer(currentLayer: MixerLayer, faderStates: AllFaders) {
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setMixerLayer, [currentLayer, faderStates]);
    }
}
