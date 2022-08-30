import {ConnectionStatus} from "../../../common/IPCConstantsToRenderer";
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
    private autoTerminal: TerminalHandle | undefined;
    private state: State = State.waiting_for_ud_connection;
    private readonly stateOnFailure: IConnectionState;
    private doneInitializingAt: number;

    public constructor(connection: UD3Connection, onFailure: IConnectionState) {
        this.stateOnFailure = onFailure;
        this.connection = connection;
        this.connect().catch((error) => {
            ipcs.connectionUI.sendConnectionError('Error: ' + error);
            console.log("While connecting: ", error);
            connection.releaseResources();
            this.state = State.failed;
        });
    }

    private async connect() {
        this.state = State.connecting;
        await this.connection.connect();
        this.autoTerminal = this.connection.setupNewTerminal((data) =>
            telemetry.receive_main(
                data,
                // After connecting the UD3 will send one alarm per 100 ms, generally less than 20 total. We
                // do not want to show toasts for these alarms that happened before TT connected, so
                // consider these 2000 ms as "initializing"
                this.state === State.initializing || (Date.now() - this.doneInitializingAt) < 2000,
                undefined,
            ));
        if (this.autoTerminal === undefined) {
            throw "Failed to create a terminal for automatic commands";
        }
        await this.connection.startTerminal(this.autoTerminal);
        this.state = State.initializing;
        await startConf();
        await ipcs.terminal.onSlotsAvailable(true);
        this.doneInitializingAt = Date.now();
        this.state = State.connected;
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

    public async pressButton(window: object): Promise<IConnectionState> {
        this.connection.releaseResources();
        return new Idle();
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
                return new Connected(this.connection, this.autoTerminal);
            case State.failed:
                return this.stateOnFailure;
            default:
                throw new Error("Unexpected state: " + this.state);
        }
    }

    public tickSlow() {
    }

    getAutoTerminal(): TerminalHandle | undefined {
        return undefined;
    }
}
