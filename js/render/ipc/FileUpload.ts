import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {processIPC} from "./IPCProvider";

export namespace FileUploadIPC {
    export async function uploadFile(file: File) {
        const data = await file.arrayBuffer();
        upload(file.name, data);
    }

    export function upload(name: string, data: ArrayBuffer) {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.loadFile, {
            bytes: [...new Uint8Array(data)],
            name,
        });
    }
}
