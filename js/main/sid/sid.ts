import * as path from "path";
import {TransmittedFile} from "../../common/IPCConstantsToMain";
import {MediaFileType, PlayerActivity} from "../../common/MediaTypes";
import {forEachCoil, forEachCoilAsync} from "../connection/connection";
import {ipcs} from "../ipc/IPCProvider";
import {checkAllTransientDisabled, checkTransientDisabled, isSID, media_state} from "../media/media_player";
import * as microtime from "../microtime";
import {getActiveSIDConnection} from "./ISidConnection";
import {AbsoluteSIDFrame, ISidSource, SidFrame} from "./sid_api";
import {DumpSidSource} from "./sid_dump";
import {EmulationSidSource} from "./sid_emulated";

let current_sid_source: ISidSource | null = null;
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
    if (nextFrameTime < microtime.now()) {
        nextFrameTime = microtime.now() + 100e3;
    }
    queuedFutureFrames.push({data: frame.data, time: nextFrameTime});
    nextFrameTime += frame.delayMicrosecond;
    // TODO command server
}

export async function flushAllSID() {
    queuedFutureFrames = [];
    await forEachCoilAsync(async (coil) => {
        await getActiveSIDConnection(coil)?.flush();
    });
}

async function stopPlayingSID() {
    await loadSidFile(media_state.currentFile);
}

export async function loadSidFile(file: TransmittedFile) {
    const extension = path.extname(file.name).substring(1).toLowerCase();
    const name = path.basename(file.name);
    if (extension === "dmp") {
        current_sid_source = new DumpSidSource(file.contents);
        await media_state.loadFile(file, MediaFileType.sid_dmp, name, [0, 1, 2], startPlayingSID, stopPlayingSID);
    } else if (extension === "sid") {
        const source_emulated = new EmulationSidSource(file.contents);
        current_sid_source = source_emulated;
        await media_state.loadFile(
            file,
            MediaFileType.sid_emulated,
            source_emulated.sid_info.title,
            [0, 1, 2],
            startPlayingSID,
            stopPlayingSID,
        );
    } else {
        throw new Error("Unknown extension " + extension);
    }
    ipcs.misc.updateMediaInfo();
}

export function update() {
    updateAsync().catch(err => console.error("Ticking SID", err));
}

async function updateAsync() {
    if (current_sid_source && media_state.state === PlayerActivity.playing && isSID(media_state.type)) {
        await checkAllTransientDisabled();
        const now = microtime.now();
        while (queuedFutureFrames.length > 0 && queuedFutureFrames[0].time < now) {
            queuedFutureFrames.shift();
        }
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
