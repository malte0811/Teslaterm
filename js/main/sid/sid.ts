import * as path from "path";
import {CoilID} from "../../common/constants";
import {MediaFileType, PlayerActivity} from "../../common/MediaTypes";
import {TransmittedFile} from "../../common/IPCConstantsToMain";
import {
    forEachCoil,
    forEachCoilAsync,
    getCoilCommands,
    getConnectionState,
    hasUD3Connection
} from "../connection/connection";
import * as connection from "../connection/connection";
import {Connected} from "../connection/state/Connected";
import {ipcs} from "../ipc/IPCProvider";
import {checkTransientDisabled, isSID, media_state} from "../media/media_player";
import {getActiveSIDConnection} from "./ISidConnection";
import {ISidSource} from "./sid_api";
import {DumpSidSource} from "./sid_dump";
import {EmulationSidSource} from "./sid_emulated";

let current_sid_source: ISidSource | null = null;

async function startPlayingSID() {
    await forEachCoilAsync(async (coil) => {
        const sidConnection = getActiveSIDConnection(coil);
        await sidConnection.flush();
        sidConnection.onStart();
    });
}

async function stopPlayingSID() {
    await loadSidFile(media_state.currentFile);
}

export async function loadSidFile(file: TransmittedFile) {
    const extension = path.extname(file.name).substr(1).toLowerCase();
    const name = path.basename(file.name);
    ipcs.menu.setMediaName("SID-File: " + name);
    if (extension === "dmp") {
        current_sid_source = new DumpSidSource(file.contents);
        await media_state.loadFile(file, MediaFileType.sid_dmp, name, startPlayingSID, stopPlayingSID);
    } else if (extension === "sid") {
        const source_emulated = new EmulationSidSource(file.contents);
        current_sid_source = source_emulated;
        await media_state.loadFile(
            file,
            MediaFileType.sid_emulated,
            source_emulated.sid_info.title,
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

function someSIDNeedsData() {
    return forEachCoil((coil) => {
        if (!hasUD3Connection(coil)) {
            return false;
        }
        const sidConnection = getActiveSIDConnection(coil);
        return sidConnection && !sidConnection.isBusy();
    }).includes(true);
}

async function updateAsync() {
    if (current_sid_source && media_state.state === PlayerActivity.playing && isSID(media_state.type)) {
        await checkTransientDisabled();
        if (someSIDNeedsData()) {
            for (let i = 0; i < 4 && !current_sid_source.isDone(); ++i) {
                const real_frame = current_sid_source.next_frame();
                forEachCoil((coil) => getActiveSIDConnection(coil)?.queueFrame(real_frame));
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
