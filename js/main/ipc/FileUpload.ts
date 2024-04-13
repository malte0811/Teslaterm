import {CoilID} from "../../common/constants";
import {IPC_CONSTANTS_TO_MAIN, TransmittedFile} from "../../common/IPCConstantsToMain";
import {ToastSeverity} from "../../common/IPCConstantsToRenderer";
import {getCoils, startBootloading} from "../connection/connection";
import * as media_player from "../media/media_player";
import {loadVMS} from "./block";
import {ipcs, MainIPC} from "./IPCProvider";

export class FileUploadIPC {
    private static async loadFile(name: string, data: number[]) {
        console.log('Loading file ', name);
        const file = new TransmittedFile(name, new Uint8Array(data));
        const extension = file.name.substring(file.name.lastIndexOf(".") + 1);
        if (extension === "zip") {
            // TODO support plain JS scripts?
            await ipcs.scripting.loadScript(file);
        } else if (extension === "cyacd") {
            const coils = [...getCoils()];
            if (coils.length !== 1) {
                ipcs.misc.openGenericToast(
                    'Bootloader',
                    "Bootloading not supported in multicoil mode",
                    ToastSeverity.error,
                    'bootload-multicoil',
                );
            } else if (!startBootloading(coils[0], file.contents)) {
                ipcs.coilMisc(coils[0]).openToast(
                    'Bootloader',
                    "Connection does not support bootloading",
                    ToastSeverity.error,
                    'bootload-not-supported',
                );
            }
        } else if (extension === "mcf") {
            loadVMS(file);
        } else {
            await media_player.loadMediaFile(file);
        }
    }

    constructor(processIPC: MainIPC) {
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.loadFile,
            (file) => FileUploadIPC.loadFile(file.name, file.bytes),
        );
    }
}
