import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {processIPC} from "./IPCProvider";

export class FileUploadIPC {
    public static async uploadFile(file: File) {
        const data = await file.arrayBuffer();
        FileUploadIPC.upload(file.name, data);
    }

    public static upload(name: string, data: ArrayBuffer) {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.loadFile, {
            bytes: [...new Uint8Array(data)],
            name,
        });
    }
}
