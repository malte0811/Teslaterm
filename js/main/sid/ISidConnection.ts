import {CoilID} from "../../common/constants";
import {getOptionalUD3Connection} from "../connection/connection";

export enum SidCommand {
    setVolume,
}

export interface ISidConnection {
    onStart(): void;

    flush(): Promise<void>;

    isBusy(): boolean;

    sendCommand(command: SidCommand, channel: number, value: number): Promise<void>;
}

export function getActiveSIDConnection(coil: CoilID): ISidConnection | null {
    return getOptionalUD3Connection(coil)?.getSidConnection();
}
