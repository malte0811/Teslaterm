import {ConnectionStatus, ToastSeverity} from "../../../common/IPCConstantsToRenderer";
import {ipcs} from "../../ipc/IPCProvider";
import {TerminalHandle, UD3Connection} from "../types/UD3Connection";
import {Connecting} from "./Connecting";
import {IConnectionState} from "./IConnectionState";
import {Idle} from "./Idle";

export class Reconnecting implements IConnectionState {
    private static readonly MAX_RETRIES = 5;
    private static readonly TICKS_BETWEEN_RETRIES = 100;
    private ticksSinceLastFailure: number = 0;
    private failedAttempts: number = 0;
    private readonly connectionToReestablish: UD3Connection;

    public constructor(connection: UD3Connection) {
        this.connectionToReestablish = connection;
    }

    getActiveConnection(): UD3Connection | undefined {
        return undefined;
    }

    public getAutoTerminal(): TerminalHandle | undefined {
        return undefined;
    }

    getConnectionStatus(): ConnectionStatus {
        return ConnectionStatus.RECONNECTING;
    }

    public async pressButton(window: object): Promise<IConnectionState> {
        return new Idle();
    }

    tickFast(): IConnectionState {
        if (this.failedAttempts >= Reconnecting.MAX_RETRIES) {
            ipcs.misc.openToast('Reconnect', "Aborting attempts to reconnect", ToastSeverity.error, 'reconnect-fail');
            return new Idle();
        }
        ++this.ticksSinceLastFailure;
        if (this.ticksSinceLastFailure > Reconnecting.TICKS_BETWEEN_RETRIES) {
            ++this.failedAttempts;
            this.ticksSinceLastFailure = 0;
            ipcs.misc.openToast(
                'Reconnect',
                "Attempting to reconnect (attempt " + this.failedAttempts + " of " + Reconnecting.MAX_RETRIES + ")...",
                ToastSeverity.info,
                'reconnect-attempt-id',
            );
            return new Connecting(this.connectionToReestablish, this);
        } else {
            return this;
        }
    }

    public tickSlow() {
    }
}
