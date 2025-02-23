import * as path from "path";
import {DroppedFile} from "../../common/IPCConstantsToMain";
import {MediaFileType, PlayerActivity, SynthType} from "../../common/MediaTypes";
import {SavedMixerState} from "../../common/UIConfig";
import {forEachCoil, forEachCoilAsync, getConnectedCoils, getMixer, getUD3Connection} from "../connection/connection";
import {ipcs} from "../ipc/IPCProvider";
import {checkAllTransientDisabled, isSID, LoadedMixerState, media_state} from "../media/media_player";
import * as microtime from "../microtime";
import {getActiveSIDConnection} from "./ISidConnection";
import {AbsoluteSIDFrame, ISidSource, SidFrame} from "./sid_api";
import {DumpSidSource} from "./sid_dump";
import {EmulationSidSource} from "./sid_emulated";

let current_sid_source: ISidSource | undefined = undefined;
let queuedFutureFrames: AbsoluteSIDFrame[] = [];
let nextFrameTime = 0;

async function startPlayingSID() {
    await flushAllSID();
    forEachCoil((coil) => {
        const sidConnection = getActiveSIDConnection(coil);
        if (sidConnection) {
            sidConnection.onStart();
        }
    });
}

export function getFirstQueuedFrameAfter(afterMicrotime: number) {
    for (const frame of queuedFutureFrames) {
        if (frame.time > afterMicrotime) {
            return frame;
        }
    }
    return undefined;
}

export function shouldQueueSIDFrames() {
    return queuedFutureFrames.length < 10;
}

export function queueSIDFrame(frame: SidFrame) {
    queuedFutureFrames.push({data: frame.data, time: nextFrameTime});
    nextFrameTime += frame.delayMicrosecond;
}

export async function flushAllSID() {
    queuedFutureFrames = [];
    nextFrameTime = microtime.now() + 50e3;
    await forEachCoilAsync(async (coil) => {
        await getActiveSIDConnection(coil)?.flush();
    });
}

async function stopPlayingSID() {
    await loadSidFile(media_state.currentFile);
}

function adjustMixerSID(baseState: SavedMixerState): LoadedMixerState {
    const channel = (i) => ({id: i});
    return {
        channels: [channel(0), channel(1), channel(2)],
        faders: baseState,
    };
}

export async function loadSidFile(file: DroppedFile) {
    const extension = path.extname(file.name).substring(1).toLowerCase();
    const name = path.basename(file.name);
    if (extension === "dmp") {
        current_sid_source = new DumpSidSource(file.bytes);
        await media_state.loadFile(
            file, MediaFileType.sid_dmp, name, startPlayingSID, stopPlayingSID, adjustMixerSID,
        );
    } else if (extension === "sid") {
        const source_emulated = new EmulationSidSource(file.bytes);
        current_sid_source = source_emulated;
        await media_state.loadFile(
            file,
            MediaFileType.sid_emulated,
            source_emulated.sid_info.title,
            startPlayingSID,
            stopPlayingSID,
            adjustMixerSID,
        );
    } else {
        throw new Error("Unknown extension " + extension);
    }
}

export function clearSidFile() {
    current_sid_source = undefined;
    queuedFutureFrames = [];
    nextFrameTime = 0;
}

export function update() {
    updateAsync().catch(err => console.error("Ticking SID", err));
}

async function updateAsync() {
    if (queuedFutureFrames.length > 0) {
        await Promise.all([
            checkAllTransientDisabled(),
            ...getConnectedCoils().map((id) => getUD3Connection(id).setSynth(SynthType.SID, true)),
        ]);
        const now = microtime.now();
        while (queuedFutureFrames.length > 0 && queuedFutureFrames[0].time < now) {
            queuedFutureFrames.shift();
        }
    }
    if (current_sid_source && media_state.state === PlayerActivity.playing && isSID(media_state.type)) {
        if (shouldQueueSIDFrames()) {
            for (let i = 0; i < 4 && !current_sid_source.isDone(); ++i) {
                queueSIDFrame(current_sid_source.next_frame());
            }
        }
        const totalFrames = current_sid_source.getTotalFrameCount();
        if (totalFrames) {
            const currentFrames = current_sid_source.getCurrentFrameCount();
            media_state.progress = Math.floor(100 * currentFrames / totalFrames);
        }
        if (current_sid_source.isDone()) {
            media_state.stopPlaying();
        }
        ipcs.misc.updateMediaInfo();
    }
}
