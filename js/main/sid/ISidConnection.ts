import {ICommandServer} from "../command/CommandServer";
import {getOptionalUD3Connection} from "../connection/connection";
import {SidFrame} from "./sid_api";

export interface ISidConnection {
    onStart(): void;

    processFrame(frame: SidFrame, commandServer: ICommandServer): Promise<void>;

    flush(): Promise<void>;

    isBusy(): boolean;

    sendVMSFrames(data: Buffer);
}

export function getActiveSIDConnection(): ISidConnection | null {
    return getOptionalUD3Connection()?.getSidConnection();
}
