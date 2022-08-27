import {ConnectionOptions} from "../../common/ConnectionOptions";
import {UD3ConnectionType} from "../../common/constants";
import {ConnectionStatus} from "../../common/IPCConstantsToRenderer";
import {config} from "../init";
import {ipcs} from "../ipc/IPCProvider";
import {media_state} from "../media/media_player";
import {BootloadableConnection} from "./bootloader/bootloadable_connection";
import {CommandInterface} from "./commands";
import {Bootloading} from "./state/Bootloading";
import {Connecting} from "./state/Connecting";
import {IConnectionState} from "./state/IConnectionState";
import {Idle} from "./state/Idle";
import {TerminalHandle, UD3Connection} from "./types/UD3Connection";

export let connectionState: IConnectionState = new Idle();
export const commands = new CommandInterface();

export async function startConf() {
    await commands.sendCommand('\r');
    if (config.command.state === "disable") {
        await ipcs.sliders.setAbsoluteOntime(0);
    } else {
        await ipcs.sliders.setRelativeOntime(0);
    }
    await commands.setBPS(ipcs.sliders.bps);
    await commands.setBurstOntime(ipcs.sliders.burstOntime);
    await commands.setBurstOfftime(ipcs.sliders.burstOfftime);
    await getUD3Connection().setSynthByFiletype(media_state.type, false);
    await commands.resetKill();
    await commands.startTelemetry();
}

export async function pressButton(window: object) {
    connectionState = await connectionState.pressButton(window);
}

export function autoConnect() {
    console.assert(connectionState instanceof Idle);
        let connectionType = config.defaultConnectOptions.defaultConnectionType;
        if (connectionType === undefined) {
                return;
        }
        let options: ConnectionOptions;
        if (connectionType === UD3ConnectionType.udp_min) {
            options = {connectionType, options: config.defaultConnectOptions.udpOptions};
        } else {
            options = {connectionType, options: config.defaultConnectOptions.serialOptions};
        }
        connectionState = new Connecting(Idle.connectWithOptions(options), new Idle());
}

export function startBootloading(cyacd: Uint8Array): boolean {
    if (hasUD3Connection()) {
        const connection = getUD3Connection();
        if (hasUD3Connection() && connection instanceof BootloadableConnection) {
            connectionState = new Bootloading(connection, getAutoTerminal(), cyacd);
            return true;
        }
    }
    return false;
}

let lastStatus: ConnectionStatus = ConnectionStatus.IDLE;

export function updateFast() {
    connectionState = connectionState.tickFast();
    const newStatus = connectionState.getConnectionStatus();
    if (newStatus !== lastStatus) {
        ipcs.misc.setConnectionState(newStatus);
    }
    lastStatus = newStatus;
}

export function updateSlow(): void {
    connectionState.tickSlow();
}

export function getUD3Connection(): UD3Connection {
    const ret = connectionState.getActiveConnection();
    if (!ret) {
        throw new Error("No connection is currently active");
    }
    return ret;
}

export function getOptionalUD3Connection(): UD3Connection | undefined {
    return connectionState.getActiveConnection();
}

export function getAutoTerminal(): TerminalHandle | undefined {
    return connectionState.getAutoTerminal();
}

export function hasUD3Connection(): boolean {
    return connectionState.getActiveConnection() !== undefined;
}

export function connectWithOptions(args: ConnectionOptions) {
    // TODO sort of a hack, I guess
    connectionState = new Connecting(Idle.connectWithOptions(args), new Idle());
}
