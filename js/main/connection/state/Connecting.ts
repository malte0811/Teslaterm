import {ConnectionStatus, ToastSeverity} from "../../../common/IPCConstantsToRenderer";
import {ipcs} from "../../ipc/IPCProvider";
import {startConf} from "../connection";
import * as telemetry from "../telemetry";
import {TerminalHandle, UD3Connection} from "../types/UD3Connection";
import {Connected} from "./Connected";
import {IConnectionState} from "./IConnectionState";
import {Idle} from "./Idle";

enum State {
    waiting_for_ud_connection,
    connecting,
    initializing,
    connected,
    failed,
}

export class Connecting implements IConnectionState {
    private readonly connection: UD3Connection;
    private state: State = State.waiting_for_ud_connection;
    private readonly stateOnFailure: IConnectionState;
    private doneInitializingAt: number;
    private readonly idleState: Idle;

    public constructor(
        connection: UD3Connection, onFailure: IConnectionState, idleState: Idle,
    ) {
        this.stateOnFailure = onFailure;
        this.connection = connection;
        this.idleState = idleState;
        this.connect().catch((error) => {
            ipcs.coilMisc(connection.getCoil()).openToast(
                'Connection error',
                this.removeErrorPrefixes(error + ''),
                ToastSeverity.error,
                'connection-error',
            );
            ipcs.connectionUI.sendConnectionError(this.removeErrorPrefixes(error + ''));
            console.log("While connecting: ", error);
            connection.releaseResources();
            this.state = State.failed;
        });
    }

    public getActiveConnection(): UD3Connection | undefined {
        if (this.state === State.initializing || this.state === State.connected) {
            return this.connection;
        } else {
            return undefined;
        }
    }

    public getConnectionStatus(): ConnectionStatus {
        return ConnectionStatus.CONNECTING;
    }

    public async disconnectFromCoil(): Promise<Idle> {
        this.connection.releaseResources();
        return this.idleState;
    }

    public tickFast(): IConnectionState {
        switch (this.state) {
            case State.waiting_for_ud_connection:
                return this;
            case State.connecting:
            case State.initializing:
                this.connection.tick();
                return this;
            case State.connected:
                return new Connected(this.connection, this.idleState);
            case State.failed:
                return this.stateOnFailure;
            default:
                throw new Error("Unexpected state: " + this.state);
        }
    }

    public tickSlow() {
    }

    public getAutoTerminal(): TerminalHandle | undefined {
        return this.connection.getAutoTerminalID();
    }

    private async connect() {
        this.state = State.connecting;
        ipcs.sliders(this.connection.getCoil()).reinitState(this.idleState.isMulticoil());
        await this.connection.connect();
        await this.connection.startTerminal(
            this.getAutoTerminal(),
            (data) => telemetry.receive_main(
                this.connection.getCoil(),
                data,
                // After connecting the UD3 will send one alarm per 100 ms, generally less than 20 total. We
                // do not want to show toasts for these alarms that happened before TT connected, so
                // consider these 2000 ms as "initializing"
                this.state === State.initializing || (Date.now() - this.doneInitializingAt) < 2000,
                true,
            ),
        );
        this.state = State.initializing;
        await startConf(this.connection.getCoil());
        await ipcs.terminal(this.connection.getCoil()).setupManualTerminal();
        this.doneInitializingAt = Date.now();
        this.state = State.connected;
    }

    private removeErrorPrefixes(withError: string): string {
        const prefix = "Error:";
        while (withError.startsWith(prefix)) {
            withError = withError.substring(prefix.length).trim();
        }
        return withError;
    }
}
