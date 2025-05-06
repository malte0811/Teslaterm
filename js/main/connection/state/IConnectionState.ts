import {ConnectionStatus} from "../../../common/IPCConstantsToRenderer";
import {TerminalHandle, UD3Connection} from "../types/UD3Connection";
import {Idle} from "./Idle";

export interface IConnectionState {
    getConnectionStatus(): ConnectionStatus;

    disconnectFromCoil(): Promise<Idle>;

    getActiveConnection(): UD3Connection | undefined;

    tickFast(): IConnectionState;

    tickSlow(): void;
}
