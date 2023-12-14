import {TransmittedFile} from "../../common/IPCConstantsToMain";
import {MediaFileType} from "../../common/MediaTypes";
import {ipcs} from "../ipc/IPCProvider";
import {media_state} from "../media/media_player";
import {player, startCurrentMidiFile, stopMidiFile} from "./midi";

export async function loadMidiFile(file: TransmittedFile) {
    ipcs.menu.setMediaName('MIDI-File: ' + file.name.substring(0, file.name.length - 4));
    await media_state.loadFile(
        file,
        MediaFileType.midi,
        file.name,
        startCurrentMidiFile,
        stopMidiFile,
    );
    player.loadArrayBuffer(file.contents);
    ipcs.scope.updateMediaInfo();
}
