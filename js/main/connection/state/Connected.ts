import {CoilID, LAST_SUPPORTED_PROTOCOL, MIN_MULTICOIL_PROTOCOL} from "../../../common/constants";
import {ConnectionStatus, ToastSeverity} from "../../../common/IPCConstantsToRenderer";
import {SynthType} from "../../../common/MediaTypes";
import {ipcs} from "../../ipc/IPCProvider";
import {BootloadableConnection} from "../bootloader/bootloadable_connection";
import {isMulticoil} from "../connection";
import {TerminalHandle, UD3Connection} from "../types/UD3Connection";
import {Bootloading} from "./Bootloading";
import {IConnectionState} from "./IConnectionState";
import {Idle} from "./Idle";
import {Reconnecting} from "./Reconnecting";

const TIMEOUT = 1000;
const lastResponseTime = new Map<CoilID, number>();

export function resetResponseTimeout(coil: CoilID) {
    lastResponseTime.set(coil, Date.now());
}

function getResponseTime(coil: CoilID) {
    if (!lastResponseTime.has(coil)) {
        lastResponseTime.set(coil, Date.now());
    }
    return lastResponseTime.get(coil);
}

export class Connected implements IConnectionState {
    private readonly activeConnection: UD3Connection;
    private readonly idleState: Idle;

    public constructor(conn: UD3Connection, idleState: Idle) {
        this.activeConnection = conn;
        this.idleState = idleState;
    }

    public getActiveConnection(): UD3Connection {
        return this.activeConnection;
    }

    public getConnectionStatus(): ConnectionStatus {
        return ConnectionStatus.CONNECTED;
    }

    public async disconnectFromCoil(): Promise<Idle> {
        try {
            await this.disconnectInternal();
            ipcs.terminal(this.activeConnection.getCoil()).onConnectionClosed();
        } catch (err) {
            console.error("While disconnecting:", err);
        }
        return this.idleState;
    }

    public tickFast(): IConnectionState {
        this.activeConnection.tick();

        if (this.isConnectionLost()) {
            ipcs.coilMisc(this.activeConnection.getCoil()).openToast(
                'Connection lost',
                'Lost connection,' +
                ' will attempt to reconnect',
                ToastSeverity.warning,
                'will-reconnect',
            );
            this.activeConnection.disconnect();
            ipcs.terminal(this.activeConnection.getCoil()).onConnectionClosed();
            return new Reconnecting(this.activeConnection, this.idleState);
        }
        const remoteProtocolVersion = this.activeConnection.getProtocolVersion();
        let disconnect = false;
        if (remoteProtocolVersion > LAST_SUPPORTED_PROTOCOL) {
            console.log(`Protocol version is ${remoteProtocolVersion}, last supported is ${LAST_SUPPORTED_PROTOCOL}`);
            ipcs.coilMisc(this.activeConnection.getCoil()).openToast(
                'Unsupported protocol version',
                'Please check for Teslaterm updates that support your UD3 version',
                ToastSeverity.error,
                'unsupported-protocol',
            );
            disconnect = true;
        } else if (isMulticoil() && remoteProtocolVersion < MIN_MULTICOIL_PROTOCOL) {
            console.log(`Protocol version is ${remoteProtocolVersion}, multicoil requires at least ${MIN_MULTICOIL_PROTOCOL}`);
            ipcs.coilMisc(this.activeConnection.getCoil()).openToast(
                'Unsupported protocol version',
                'Please check for updates to the UD3 firmware that support multicoil mode',
                ToastSeverity.error,
                'unsupported-protocol',
            );
            disconnect = true;
        }
        if (disconnect) {
            this.activeConnection.disconnect()
                .catch((e) => console.error('During version-based disconnect', e));
            ipcs.terminal(this.activeConnection.getCoil()).onConnectionClosed();
            return this.idleState;
        } else {
            return this;
        }
    }

    public tickSlow() {
        this.activeConnection.resetWatchdog();
    }

    public startBootloading(cyacd: Uint8Array): IConnectionState | undefined {
        if (this.activeConnection instanceof BootloadableConnection) {
            return new Bootloading(this.activeConnection, this.idleState, cyacd);
        } else {
            return undefined;
        }
    }

    public async sendMIDI(data: Buffer) {
        await this.activeConnection.sendMidi(data);
        await this.activeConnection.setSynth(SynthType.MIDI, true);
    }

    private isConnectionLost(): boolean {
        if (this.activeConnection instanceof BootloadableConnection) {
            const bootConnection = this.activeConnection as BootloadableConnection;
            if (bootConnection.isBootloading()) {
                // TODO detect lost connection in bootloader mode (and fully disconnect)?
                return false;
            }
        }
        const coil = this.getActiveConnection().getCoil();
        return Date.now() - getResponseTime(coil) > TIMEOUT;
    }

    private async disconnectInternal() {
        try {
            await this.activeConnection.commands().stop();
        } catch (e) {
            console.error("Failed to send stop command:", e);
        }
        await this.activeConnection.disconnect();
    }
}
