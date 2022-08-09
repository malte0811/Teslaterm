import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {processIPC} from "./IPCProvider";

export namespace FileUploadIPC {
    export function uploadFile(file: File) {
        file.arrayBuffer()
            .then((buffer) => upload(file.name, buffer));
    }

    export function upload(name: string, data: ArrayBuffer) {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.loadFile, {
            name,
            bytes: [...new Uint8Array(data)]
        });
    }
}
