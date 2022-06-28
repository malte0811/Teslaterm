import * as path from "path";
import {MediaFileType, PlayerActivity} from "../../common/CommonTypes";
import {TransmittedFile} from "../../common/IPCConstantsToMain";
import * as connection from "../connection/connection";
import {ipcs} from "../ipc/IPCProvider";
import {checkTransientDisabled, isSID, media_state} from "../media/media_player";
import {ISidSource} from "./sid_api";
import {DumpSidSource} from "./sid_dump";
import {EmulationSidSource} from "./sid_emulated";

let current_sid_source: ISidSource | null = null;

async function startPlayingSID() {
    const sidConnection = connection.getUD3Connection().getSidConnection();
    await sidConnection.flush();
    sidConnection.onStart();
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
    ipcs.scope.updateMediaInfo();
}

export function update() {
    if (!connection.hasUD3Connection()) {
        return;
    }
    const sidConnection = connection.getUD3Connection().getSidConnection();
    if (current_sid_source && media_state.state === PlayerActivity.playing && isSID(media_state.type)
        && !sidConnection.isBusy()) {
        checkTransientDisabled();
        if (connection.hasUD3Connection()) {
            for (let i = 0; i < 4 && !current_sid_source.isDone(); ++i) {
                const real_frame = current_sid_source.next_frame();
                sidConnection.processFrame(real_frame);
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
        ipcs.scope.updateMediaInfo();
    }
}
