import {TransmittedFile} from "../../common/IPCConstantsToMain";
import {MediaFileType} from "../../common/MediaTypes";
import {ipcs} from "../ipc/IPCProvider";
import {media_state} from "../media/media_player";
import {player, startCurrentMidiFile, stopMidiFile} from "./midi";

export async function loadMidiFile(file: TransmittedFile) {
    player.loadArrayBuffer(file.contents);
    // TODO for some reason getEvents() is a 2-dim array despite the signature?
    const events = player.getEvents()[0] as unknown as Array<{channel?: number}>;
    const uniqueChannels = [];
    let last = -1234;
    for (const channel of events.map((ev) => ev.channel).sort((i, j) => i - j)) {
        if (channel !== last && channel !== undefined) {
            last = channel;
            uniqueChannels.push(channel);
        }
    }
    await media_state.loadFile(
        file,
        MediaFileType.midi,
        file.name.substring(0, file.name.length - 4),
        uniqueChannels,
        startCurrentMidiFile,
        stopMidiFile,
    );
    console.log(`Used channels: ${uniqueChannels}`);
    ipcs.misc.updateMediaInfo();
}
