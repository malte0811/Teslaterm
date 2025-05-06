import * as path from "path";
import {CoilID} from "../../common/constants";
import {DroppedFile} from "../../common/IPCConstantsToMain";
import {ChannelID, ToastSeverity} from "../../common/IPCConstantsToRenderer";
import {MediaFileType, PlayerActivity} from "../../common/MediaTypes";
import {CoilMixerState, SavedMixerState} from "../../common/UIConfig";
import {
    findCoilByName,
    forEachCoilAsync,
    getCoilCommands, getMixer,
    getUD3Connection,
    hasUD3Connection,
} from "../connection/connection";
import {getUD3State} from "../connection/telemetry/UD3State";
import {ipcs} from "../ipc/IPCProvider";
import {loadMidiFile} from "../midi/midi_file";
import * as scripting from "../scripting";
import {loadSidFile} from "../sid/sid";
import {getDefaultVolumes, getUIConfig} from "../UIConfigHandler";

export function isSID(type: MediaFileType): boolean {
    return type === MediaFileType.sid_dmp || type === MediaFileType.sid_emulated;
}

function applyCoilMixerState(coil: CoilID | undefined, state: CoilMixerState) {
    getMixer()?.updateVolume({coil}, state.masterSetting, false);
    getMixer()?.updateVolume({coil, channel: 'sidSpecial'}, state.sidSpecialSettings, false);
    state.channelSettings.forEach((settings, channel) => {
        if (settings !== undefined) {
            getMixer()?.updateVolume({coil, channel}, settings, false);
        }
    });
}

function applyMixerState(state: SavedMixerState) {
    applyCoilMixerState(undefined, state.masterSettings);
    for (const [coilName, settings] of Object.entries(state.coilSettings)) {
        const coil = findCoilByName(coilName);
        if (coil !== undefined) {
            applyCoilMixerState(coil, settings);
        }
    }
    state.channelPrograms.forEach((programName, channel) => {
        if (programName !== undefined) {
            const programID = getUIConfig().syncedConfig.midiPrograms.indexOf(programName);
            if (programID >= 0) {
                getMixer()?.setProgramForChannel(channel, programID);
            }
        }
    });
}

export class PlayerState {
    public get currentFile(): DroppedFile | undefined {
        return this.currentFileInt;
    }

    public get type(): MediaFileType {
        return this.typeInt;
    }

    public get state(): PlayerActivity {
        return this.stateInt;
    }

    public get title(): string {
        return this.titleInt;
    }

    public progress: number;
    private currentFileInt: DroppedFile | undefined;
    private typeInt: MediaFileType;
    private startCallback: (() => Promise<void>) | undefined = undefined;
    private stopCallback: (() => void) | undefined = undefined;
    private titleInt: string | undefined;
    private stateInt: PlayerActivity = PlayerActivity.idle;
    private readonly listeners: Array<(state: PlayerActivity) => any> = [];

    public constructor() {
        this.currentFileInt = undefined;
        this.typeInt = MediaFileType.none;
        this.progress = 0;
        this.titleInt = undefined;
    }

    public async loadFile(
        file: DroppedFile,
        type: MediaFileType,
        title: string,
        startCallback?: () => Promise<void>,
        stopCallback?: () => void,
    ) {
        this.titleInt = title;
        this.typeInt = type;
        this.currentFileInt = file;
        this.startCallback = startCallback;
        this.stopCallback = stopCallback;
        this.progress = 0;
        const prefix = type === MediaFileType.midi ? 'MIDI file: ' : "SID file: ";
        ipcs.menu.setMediaName(prefix + title);
        ipcs.misc.updateMediaInfo();
        await forEachCoilAsync(async (coil) => {
            if (hasUD3Connection(coil)) {
                await getUD3Connection(coil).setSynthByFiletype(type, false);
            }
        });
        applyMixerState(getDefaultVolumes(title));
    }

    public async startPlaying(): Promise<void> {
        if (this.currentFile === null) {
            ipcs.misc.openGenericToast(
                "Media", "Please select a media file using drag&drop", ToastSeverity.info, "media",
            );
            return;
        }
        if (this.state !== PlayerActivity.idle) {
            ipcs.misc.openGenericToast(
                "Media",
                "A media file is currently playing, stop it before starting it again",
                ToastSeverity.info,
                "media",
            );
            return;
        }
        if (this.startCallback) {
            await this.startCallback();
        }
        this.setState(PlayerActivity.playing);
    }

    public stopPlaying(): void {
        if (this.currentFile === null || this.state !== PlayerActivity.playing) {
            ipcs.misc.openGenericToast("Media", "No media file is currently playing", ToastSeverity.info, "media");
            return;
        }
        if (this.stopCallback) {
            this.stopCallback();
        }
        this.setState(PlayerActivity.idle);
        ipcs.misc.updateMediaInfo();
        scripting.onMediaStopped();
    }

    public addUpdateCallback(mediaUpdateCallback: (state: PlayerActivity) => any) {
        this.listeners.push(mediaUpdateCallback);

    }

    public removeUpdateCallback(mediaUpdateCallback: (state: PlayerActivity) => any) {
        const index = this.listeners.indexOf(mediaUpdateCallback);
        this.listeners[index] = this.listeners[this.listeners.length - 1];
        this.listeners.pop();
    }

    private setState(state: PlayerActivity) {
        this.stateInt = state;
        this.listeners.forEach((cb) => cb(state));
    }
}


export let media_state = new PlayerState();

const lastTimeoutReset: Map<CoilID, number> = new Map<CoilID, number>();

export async function checkTransientDisabled(coil: CoilID) {
    if (getUD3State(coil).transientActive) {
        const currTime = new Date().getTime();
        if (!lastTimeoutReset.has(coil) || currTime - lastTimeoutReset.get(coil) > 500) {
            await getCoilCommands(coil).setTransientEnabled(false);
            lastTimeoutReset.set(coil, currTime);
        }
    }
}

export async function checkAllTransientDisabled() {
    await forEachCoilAsync(checkTransientDisabled);
}

export function isMediaFile(filename: string): boolean {
    const extension = path.extname(filename).substring(1).toLowerCase();
    return extension === "mid" || extension === "sid" || extension === "dmp";
}

export async function loadMediaFile(file: DroppedFile): Promise<void> {
    if (media_state.state === PlayerActivity.playing) {
        media_state.stopPlaying();
    }
    const extension = path.extname(file.name).substring(1).toLowerCase();
    if (extension === "mid") {
        await loadMidiFile(file);
    } else if (extension === "dmp" || extension === "sid") {
        await loadSidFile(file);
    } else {
        ipcs.misc.openGenericToast('Media', "Unknown extension: " + extension, ToastSeverity.warning, 'unknown-extension');
    }
}
