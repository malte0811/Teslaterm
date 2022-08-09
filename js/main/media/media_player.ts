import * as path from "path";
import {MediaFileType, PlayerActivity} from "../../common/CommonTypes";
import {TransmittedFile} from "../../common/IPCConstantsToMain";
import {ToastSeverity} from "../../common/IPCConstantsToRenderer";
import {commands, getUD3Connection, hasUD3Connection} from "../connection/connection";
import {transientActive} from "../connection/telemetry/UD3State";
import {config} from "../init";
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
        startCallback?: () => Promise<void>,
        stopCallback?: () => void,
    ) {
        this.titleInt = title;
        this.typeInt = type;
        this.currentFileInt = file;
        this.startCallback = startCallback;
        this.stopCallback = stopCallback;
        this.progress = 0;
        if (hasUD3Connection()) {
            await getUD3Connection().setSynthByFiletype(type, false);
        }
    }

    // TODO convert to toasts
    public async startPlaying(): Promise<void> {
        if (this.currentFile === null) {
            ipcs.terminal.println("Please select a media file using drag&drop");
            return;
        }
        if (this.state !== PlayerActivity.idle) {
            ipcs.terminal.println("A media file is currently playing, stop it before starting it again");
            return;
        }
        if (this.startCallback) {
            await this.startCallback();
        }
        this.stateInt = PlayerActivity.playing;
    }

    public stopPlaying(): void {
        if (this.currentFile === null || this.state !== PlayerActivity.playing) {
            ipcs.terminal.println("No media file is currently playing");
            return;
        }
        if (this.stopCallback) {
            this.stopCallback();
        }
        this.stateInt = PlayerActivity.idle;
        ipcs.scope.updateMediaInfo();
        scripting.onMediaStopped();
    }
}


export let media_state = new PlayerState();

let lastTimeoutReset: number = 0;

export function checkTransientDisabled() {
    if (transientActive) {
        const currTime = new Date().getTime();
        if (currTime - lastTimeoutReset > 500) {
            commands.setTransientEnabled(false);
            lastTimeoutReset = currTime;
        }
    }
}

export function isMediaFile(filename: string): boolean {
    const extension = path.extname(filename).substr(1).toLowerCase();
    return extension === "mid" || extension === "sid" || extension === "dmp";
}

export async function loadMediaFile(file: TransmittedFile): Promise<void> {
    if (config.command.state === "client") {
        ipcs.misc.openToast('Media', "Cannot load media files on command client!", ToastSeverity.info, 'media-command-client');
        return;
    }
    if (media_state.state === PlayerActivity.playing) {
        media_state.stopPlaying();
    }
    const extension = path.extname(file.name).substr(1).toLowerCase();
    if (extension === "mid") {
        await loadMidiFile(file);
    } else if (extension === "dmp" || extension === "sid") {
        await loadSidFile(file);
    } else {
        ipcs.misc.openToast('Media', "Unknown extension: " + extension, ToastSeverity.warning, 'unknown-extension');
    }
}
