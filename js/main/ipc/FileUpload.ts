import JSZip from "jszip";
import {IPC_CONSTANTS_TO_MAIN, TransmittedFile} from "../../common/IPCConstantsToMain";
import {ToastSeverity} from "../../common/IPCConstantsToRenderer";
import {getCoils, getMixer, isMulticoil, startBootloading} from "../connection/connection";
import {isMediaFile} from "../media/media_player";
import * as media_player from "../media/media_player";
import {loadVMS} from "./block";
import {ipcs, MainIPC} from "./IPCProvider";

export class FileUploadIPC {
    private static async loadFile(name: string, data: number[]) {
        console.log('Loading file ', name);
        const file = new TransmittedFile(name, new Uint8Array(data));
        const extension = file.name.substring(file.name.lastIndexOf(".") + 1);
        if (extension === "zip") {
            const loadedZip: JSZip = await JSZip.loadAsync(data);
            const fileNames = Object.keys(loadedZip.files);
            const scriptName = FileUploadIPC.findScriptName(fileNames);
            if (scriptName !== undefined) {
                await ipcs.scripting.loadScript(loadedZip, scriptName);
            } else if (isMulticoil() && this.isMediaCollection(fileNames)) {
                await getMixer()?.loadPlaylist(loadedZip);
            }
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

    private static findScriptName(files: string[]) {
        const scriptNames = files.filter((name) => name.endsWith('.js'));
        if (scriptNames.length === 1) {
            return scriptNames[0];
        } else {
            return undefined;
        }
    }

    private static isMediaCollection(files: string[]) {
        return files.length > 0 && files.every(isMediaFile);
    }

    constructor(processIPC: MainIPC) {
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.loadFile,
            (file) => FileUploadIPC.loadFile(file.name, file.bytes),
        );
    }
}
