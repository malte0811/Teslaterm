import {CoilID} from "../../common/constants";
import {getOptionalUD3Connection} from "../connection/connection";
import {SidFrame} from "./sid_api";

export interface ISidConnection {
    onStart(): void;

    flush(): Promise<void>;

    isBusy(): boolean;
}

export function getActiveSIDConnection(coil: CoilID): ISidConnection | null {
    return getOptionalUD3Connection(coil)?.getSidConnection();
}
