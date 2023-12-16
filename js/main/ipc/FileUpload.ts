import {CoilID} from "../../common/constants";
import {IPC_CONSTANTS_TO_MAIN, TransmittedFile} from "../../common/IPCConstantsToMain";
import {ToastSeverity} from "../../common/IPCConstantsToRenderer";
import {startBootloading} from "../connection/connection";
import * as media_player from "../media/media_player";
import {BlockSender} from "./block";
import {ipcs, MultiWindowIPC} from "./IPCProvider";

export class FileUploadIPC {
    private static async loadFile(source: object, name: string, data: number[], coil?: CoilID) {
        const file = new TransmittedFile(name, new Uint8Array(data));
        const extension = file.name.substring(file.name.lastIndexOf(".") + 1);
        if (extension === "zip") {
            // TODO support plain JS scripts?
            await ipcs.scripting.loadScript(file);
        } else if (extension === "cyacd") {
            if (coil && !startBootloading(coil, file.contents)) {
                ipcs.coilMisc(coil).openToast(
                    'Bootloader',
                    "Connection does not support bootloading",
                    ToastSeverity.error,
                    'bootload-not-supported',
                    source,
                );
            }
        } else if (extension === "mcf") {
            await BlockSender.loadBlocks(file);
        } else {
            await media_player.loadMediaFile(file);
        }
    }

    private readonly processIPC: MultiWindowIPC;

    constructor(processIPC: MultiWindowIPC) {
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.loadFile,
            (source, file) => FileUploadIPC.loadFile(source, file.name, file.bytes, file.coil),
        );
        this.processIPC = processIPC;
    }
}
