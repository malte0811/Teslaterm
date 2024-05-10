import * as path from "path";
import {CoilID} from "../../common/constants";
import {TransmittedFile} from "../../common/IPCConstantsToMain";
import {ToastSeverity} from "../../common/IPCConstantsToRenderer";
import {MediaFileType, PlayerActivity} from "../../common/MediaTypes";
import {forEachCoilAsync, getCoilCommands, getUD3Connection, hasUD3Connection} from "../connection/connection";
import {getUD3State} from "../connection/telemetry/UD3State";
import {ipcs} from "../ipc/IPCProvider";
import {loadMidiFile} from "../midi/midi_file";
import * as scripting from "../scripting";
import {loadSidFile} from "../sid/sid";

export function isSID(type: MediaFileType): boolean {
    return type === MediaFileType.sid_dmp || type === MediaFileType.sid_emulated;
}

export class PlayerState {
    public get currentFile(): TransmittedFile | undefined {
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
    private currentFileInt: TransmittedFile | undefined;
    private typeInt: MediaFileType;
    private startCallback: (() => Promise<void>) | undefined = undefined;
    private stopCallback: (() => void) | undefined = undefined;
    private titleInt: string | undefined;
    private stateInt: PlayerActivity = PlayerActivity.idle;
    private voices: number[] = [0, 1, 2];

    public constructor() {
        this.currentFileInt = undefined;
        this.typeInt = MediaFileType.none;
        this.progress = 0;
        this.titleInt = undefined;
    }

    public async loadFile(
        file: TransmittedFile,
        type: MediaFileType,
        title: string,
        voices: number[],
        startCallback?: () => Promise<void>,
        stopCallback?: () => void,
    ) {
        this.titleInt = title;
        this.typeInt = type;
        this.currentFileInt = file;
        this.startCallback = startCallback;
        this.stopCallback = stopCallback;
        this.progress = 0;
        this.voices = voices;
        const prefix = type === MediaFileType.midi ? 'MIDI file: ' : "SID file: ";
        ipcs.menu.setMediaName(prefix + title);
        ipcs.mixer.setChannels(this.voices);
        await forEachCoilAsync(async (coil) => {
            if (hasUD3Connection(coil)) {
                await getUD3Connection(coil).setSynthByFiletype(type, false);
            }
        });
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
        this.stateInt = PlayerActivity.playing;
    }

    public stopPlaying(): void {
        if (this.currentFile === null || this.state !== PlayerActivity.playing) {
            ipcs.misc.openGenericToast("Media", "No media file is currently playing", ToastSeverity.info, "media");
            return;
        }
        if (this.stopCallback) {
            this.stopCallback();
        }
        this.stateInt = PlayerActivity.idle;
        ipcs.misc.updateMediaInfo();
        scripting.onMediaStopped();
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
    const extension = path.extname(filename).substr(1).toLowerCase();
    return extension === "mid" || extension === "sid" || extension === "dmp";
}

export async function loadMediaFile(file: TransmittedFile): Promise<void> {
    if (media_state.state === PlayerActivity.playing) {
        media_state.stopPlaying();
    }
    const extension = path.extname(file.name).substr(1).toLowerCase();
    if (extension === "mid") {
        await loadMidiFile(file);
    } else if (extension === "dmp" || extension === "sid") {
        await loadSidFile(file);
    } else {
        ipcs.misc.openGenericToast('Media', "Unknown extension: " + extension, ToastSeverity.warning, 'unknown-extension');
    }
}
