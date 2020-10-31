import {PlayerActivity} from "../../../common/CommonTypes";
import {TerminalIPC} from "../../ipc/terminal";
import {BootloadableConnection} from "../bootloader/bootloadable_connection";
import {commands} from "../connection";
import {TerminalHandle, UD3Connection} from "../types/UD3Connection";
import {IConnectionState} from "./IConnectionState";
import {Idle} from "./Idle";
import * as media from "../../media/media_player";
import {Reconnecting} from "./Reconnecting";

const TIMEOUT = 1000;
let lastResponseTime = Date.now();
const WD_TIMEOUT = 10;
let wd_reset = WD_TIMEOUT;

export function resetResponseTimeout() {
    lastResponseTime = Date.now();
}

export class Connected implements IConnectionState {
    private readonly active_connection: UD3Connection;
    private readonly autoTerminal: TerminalHandle;

    public constructor(conn: UD3Connection, autoTerm: TerminalHandle) {
        this.active_connection = conn;
        this.autoTerminal = autoTerm;
    }

    public getActiveConnection(): UD3Connection | undefined {
        return this.active_connection;
    }

    public getButtonText(): string {
        return "Disconnect";
    }

    public pressButton(window: object): IConnectionState {
        console.log("Disconnecting");
        this.disconnectInternal().then(() => {
            // NOP
        });
        TerminalIPC.onConnectionClosed();
        return new Idle();
    }

    public tickFast(): IConnectionState {
        this.active_connection.tick();

        if (this.isConnectionLost()) {
            TerminalIPC.println("\n\rLost connection, will attempt to reconnect");
            this.active_connection.disconnect();
            TerminalIPC.onConnectionClosed();
            Connected.killMedia();
            return new Reconnecting(this.active_connection);
        }

        return this;
    }

    public tickSlow() {
        this.active_connection.resetWatchdog();
    }

    private isConnectionLost(): boolean {
        if (this.active_connection instanceof BootloadableConnection) {
            const bootConnection = this.active_connection as BootloadableConnection;
            if (bootConnection.isBootloading()) {
                //TODO detect lost connection in bootloader mode (and fully disconnect)?
                return false;
            }
        }
        return Date.now() - lastResponseTime > TIMEOUT;
    }

    private async disconnectInternal() {
        try {
            Connected.killMedia();
            await commands.stop();
        } catch (e) {
            console.error("Failed to send stop command:", e);
        }
        await this.active_connection.disconnect();
    }

    private static killMedia() {
        if (media.media_state.state == PlayerActivity.playing) {
            media.media_state.stopPlaying();
        }
    }

    getAutoTerminal(): TerminalHandle | undefined {
        return this.autoTerminal;
    }
}
