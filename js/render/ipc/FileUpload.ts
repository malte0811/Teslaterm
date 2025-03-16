import {webUtils} from 'electron';
import {DroppedFile, IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {processIPC} from "./IPCProvider";

export class FileUploadIPC {
    public static async uploadFiles(files: File[]) {
        const droppedFiles = await Promise.all(files.map(async (f) => ({
            bytes: [...new Uint8Array(await f.arrayBuffer())],
            name: f.name,
            path: webUtils.getPathForFile(f),
        } as DroppedFile)));
        processIPC.send(IPC_CONSTANTS_TO_MAIN.loadFile, droppedFiles);
    }
}
