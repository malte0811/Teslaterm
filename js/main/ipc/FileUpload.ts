import JSZip from "jszip";
import {DroppedFile, IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {ToastSeverity} from "../../common/IPCConstantsToRenderer";
import {getCoils, getMixer, isMulticoil, startBootloading} from "../connection/connection";
import {isMediaFile} from "../media/media_player";
import * as media_player from "../media/media_player";
import {loadVMS} from "./block";
import {ipcs, MainIPC} from "./IPCProvider";

export class FileUploadIPC {
    private static async loadSingleFile(file: DroppedFile) {
        const extension = file.name.substring(file.name.lastIndexOf(".") + 1);
        if (extension === "zip") {
            const loadedZip: JSZip = await JSZip.loadAsync(file.bytes);
            const fileNames = Object.keys(loadedZip.files);
            const scriptName = FileUploadIPC.findScriptName(fileNames);
            if (scriptName !== undefined) {
                await ipcs.scripting.loadScript(loadedZip, scriptName);
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
            } else if (!startBootloading(coils[0], file.bytes)) {
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

    private static async loadFiles(files: DroppedFile[]) {
        if (files.length === 1) {
            await FileUploadIPC.loadSingleFile(files[0]);
            return;
        }
        const fileNames = files.map((f) => f.name);
        const hasScript = FileUploadIPC.findScriptName(fileNames);
        if (hasScript) {
            const zip = new JSZip();
            for (const file of files) {
                zip.file(file.name, file.bytes);
            }
            const zipContent = await zip.generateAsync({type: 'array'});
            await FileUploadIPC.loadSingleFile({name: 'multiple-files.zip', bytes: zipContent});
        } else if (isMulticoil() && FileUploadIPC.isMediaCollection(fileNames)) {
            await getMixer()?.loadPlaylist(files);
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
        processIPC.onAsync(IPC_CONSTANTS_TO_MAIN.loadFile, FileUploadIPC.loadFiles);
    }
}
