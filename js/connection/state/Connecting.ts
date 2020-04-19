import {terminal} from "../../gui/constants";
import {populateMIDISelects} from "../../midi/midi_ui";
import {startConf} from "../../network/commands";
import {IUD3Connection} from "../IUD3Connection";
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
    private connection: IUD3Connection | undefined;
    private state: State = State.waiting_for_ud_connection;

    public constructor(connection: Promise<IUD3Connection | undefined>) {
        connection.then(async (c) => {
            this.connection = c;
            if (c) {
                this.state = State.connecting;
                try {
                    await c.connect();
                    this.state = State.initializing;
                    await startConf();
                    populateMIDISelects();
                    this.state = State.connected;
                } catch (x) {
                    terminal.io.println("Failed to connect");
                    console.log("While connecting: ", x);
                    this.state = State.failed;
                }
            } else {
                this.state = State.failed;
            }
        });
    }

    public getActiveConnection(): IUD3Connection | undefined {
        if (this.state === State.initializing || this.state === State.connected) {
            return this.connection;
        } else {
            return undefined;
        }
    }

    public getButtonText(): string {
        return "Connecting";
    }

    public getButtonTooltip(): string {
        return "Click to abort";
    }

    public pressButton(): IConnectionState {
        console.log("Aborting connection");
        return new Idle();
    }

    public tick(): IConnectionState {
        switch (this.state) {
            case State.waiting_for_ud_connection:
                return this;
            case State.connecting:
            case State.initializing:
                this.connection.tick();
                return this;
            case State.connected:
                return new Connected(this.connection);
            case State.failed:
                return new Idle();
            default:
                throw new Error("Unexpected state: " + this.state);
        }
    }
}
