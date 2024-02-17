import {ConnectionStatus, ToastSeverity} from "../../../common/IPCConstantsToRenderer";
import {AdvancedOptions, CommandRole} from "../../../common/Options";
import {DUMMY_SERVER, ICommandServer} from "../../command/CommandServer";
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
    private readonly idleState: Idle;

    public constructor(connection: UD3Connection, idleState: Idle) {
        this.connectionToReestablish = connection;
        this.idleState = idleState;
    }

    public getActiveConnection(): UD3Connection | undefined {
        return undefined;
    }

    public getAutoTerminal(): TerminalHandle | undefined {
        return undefined;
    }

    public getConnectionStatus(): ConnectionStatus {
        return ConnectionStatus.RECONNECTING;
    }

    public async disconnectFromCoil(): Promise<Idle> {
        return this.idleState;
    }

    public tickFast(): IConnectionState {
        const miscIPC = ipcs.coilMisc(this.connectionToReestablish.getCoil());
        if (this.failedAttempts >= Reconnecting.MAX_RETRIES) {
            miscIPC.openToast('Reconnect', "Aborting attempts to reconnect", ToastSeverity.error, 'reconnect-fail');
            return this.idleState;
        }
        ++this.ticksSinceLastFailure;
        if (this.ticksSinceLastFailure > Reconnecting.TICKS_BETWEEN_RETRIES) {
            ++this.failedAttempts;
            this.ticksSinceLastFailure = 0;
            miscIPC.openToast(
                'Reconnect',
                "Attempting to reconnect (attempt " + this.failedAttempts + " of " + Reconnecting.MAX_RETRIES + ")...",
                ToastSeverity.info,
                'reconnect-attempt-id',
            );
            return new Connecting(this.connectionToReestablish, this, this.idleState);
        } else {
            return this;
        }
    }

    public tickSlow() {
    }

    public getCommandServer(): ICommandServer {
        return DUMMY_SERVER;
    }

    public getCommandRole(): CommandRole {
        return this.idleState.getAdvancedOptions().commandOptions.state;
    }
}
