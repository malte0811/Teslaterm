import {ConnectionOptions} from "../../common/ConnectionOptions";
import {UD3ConnectionType} from "../../common/constants";
import {ConnectionStatus} from "../../common/IPCConstantsToRenderer";
import {AdvancedOptions, CommandRole} from "../../common/Options";
import {getDefaultAdvancedOptions} from "../../common/TTConfig";
import {config} from "../init";
import {ipcs} from "../ipc/IPCProvider";
import {media_state} from "../media/media_player";
import {CommandInterface} from "./commands";
import {FlightEventType, getFlightRecorder} from "./FlightRecorder";
import {Connected} from "./state/Connected";
import {Connecting} from "./state/Connecting";
import {IConnectionState} from "./state/IConnectionState";
import {Idle} from "./state/Idle";
import {TerminalHandle, UD3Connection} from "./types/UD3Connection";

export let connectionState: IConnectionState = new Idle();
export const commands = new CommandInterface();

export async function startConf(commandState: CommandRole) {
    await commands.sendCommand('\r');
    if (commandState === "disable") {
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

export async function autoConnect() {
    console.assert(connectionState instanceof Idle);
    const connectionType = config.defaultConnectOptions.defaultConnectionType;
    if (connectionType === undefined) {
        return;
    }
    const advanced: AdvancedOptions = getDefaultAdvancedOptions(config);
    let options: ConnectionOptions;
    if (connectionType === UD3ConnectionType.udp_min) {
        options = {connectionType, options: config.defaultConnectOptions.udpOptions, advanced};
    } else {
        options = {connectionType, options: config.defaultConnectOptions.serialOptions, advanced};
    }
    const connection = await Idle.connectWithOptions(options);
    if (connection) {
        connectionState = new Connecting(connection, new Idle(), options.advanced);
    }
}

export function startBootloading(cyacd: Uint8Array): boolean {
    if (connectionState instanceof Connected) {
        const newConnection = connectionState.startBootloading(cyacd);
        if (newConnection) {
            connectionState = newConnection;
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
        getFlightRecorder().addEvent(FlightEventType.connection_state_change, [newStatus]);
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

export async function connectWithOptions(args: ConnectionOptions) {
    // TODO sort of a hack, I guess
    const connection = await Idle.connectWithOptions(args);
    if (connection) {
        connectionState = new Connecting(connection, new Idle(), args.advanced);
    }
}
