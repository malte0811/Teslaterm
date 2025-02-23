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
    hasUD3Connection, isMulticoil,
} from "../connection/connection";
import {getUD3State} from "../connection/telemetry/UD3State";
import {sleep} from "../helper";
import {ipcs} from "../ipc/IPCProvider";
import {clearMidiFile, loadMidiFile} from "../midi/midi_file";
import * as scripting from "../scripting";
import {clearSidFile, loadSidFile} from "../sid/sid";
import {getDefaultVolumes, getUIConfig, overwriteStoredMixerState} from "../UIConfigHandler";
import {MixerState} from "./mixer/MixerState";

export function isSID(type: MediaFileType): boolean {
    return type === MediaFileType.sid_dmp || type === MediaFileType.sid_emulated;
}

function applyCoilMixerState(mixer: MixerState, coil: CoilID | undefined, state: CoilMixerState) {
    mixer.updateVolume({coil}, state.masterSetting, false);
    mixer.updateVolume({coil, channel: 'sidSpecial'}, state.sidSpecialSettings, false);
    state.channelSettings.forEach((settings, channel) => {
        if (settings !== undefined) {
            mixer.updateVolume({coil, channel}, settings, false);
        }
    });
}

function applyMixerState(state: LoadedMixerState) {
    const mixer = getMixer();
    if (!mixer) { return; }
    mixer.resetBeforeSongLoad();
    mixer.setChannels(state.channels.map((c) => c.id));
    const channelNames = new Map<ChannelID, string>();
    const channelPrograms = new Map<ChannelID, number>();
    for (const channel of state.channels) {
        channelNames.set(channel.id, channel.name || `Channel ${channel.id}`);
    }
    mixer.setChannelNames(channelNames);
    mixer.setProgramsByVoice(channelPrograms);
    applyCoilMixerState(mixer, undefined, state.faders.masterSettings);
    for (const [coilName, settings] of Object.entries(state.faders.coilSettings)) {
        const coil = findCoilByName(coilName);
        if (coil !== undefined) {
            applyCoilMixerState(mixer, coil, settings);
        }
    }
    state.faders.channelPrograms.forEach((programName, channel) => {
        if (programName !== undefined) {
            const programID = getUIConfig().syncedConfig.midiPrograms.indexOf(programName);
            if (programID >= 0) {
                mixer.setProgramForChannel(channel, programID);
            }
        }
    });
}

async function doPrecount() {
    const precountOptions = getUIConfig().syncedConfig.showmodeOptions.precount;
    if (!(isMulticoil() && precountOptions.enabled)) {
        return;
    }
    for (let i = 0; i < precountOptions.numBeats; ++i) {
        await forEachCoilAsync(async (coil) => {
            if (!hasUD3Connection(coil)) {
                return;
            }
            const ontime = precountOptions.ontimePercent / 100 * ipcs.sliders(coil).ontime;
            const volume = precountOptions.volumePercent * getMixer().getCoilVolumeMultiplier(coil);
            await getCoilCommands(coil).singlePulse(ontime, volume);
        });
        await sleep(precountOptions.delayMs);
    }
}

export interface LoadedMixerState {
    faders: SavedMixerState;
    channels: Array<{id: number, name?: string}>;
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
        startCallback: () => Promise<void>,
        stopCallback: () => void,
        adjustMixerState: (baseState: SavedMixerState) => LoadedMixerState,
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
        const mixerBaseState = structuredClone(getDefaultVolumes(title));
        const loadedState = adjustMixerState(mixerBaseState);
        applyMixerState(loadedState);
        overwriteStoredMixerState(this.title, loadedState.faders);
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
        await doPrecount();
        await this.startCallback();
        this.setState(PlayerActivity.playing);
    }

    public stopPlaying(): void {
        if (this.currentFile === null || this.state !== PlayerActivity.playing) {
            ipcs.misc.openGenericToast("Media", "No media file is currently playing", ToastSeverity.info, "media");
            return;
        }
        this.stopCallback();
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
        clearSidFile();
        await loadMidiFile(file);
    } else if (extension === "dmp" || extension === "sid") {
        clearMidiFile();
        await loadSidFile(file);
    } else {
        ipcs.misc.openGenericToast('Media', "Unknown extension: " + extension, ToastSeverity.warning, 'unknown-extension');
    }
}
