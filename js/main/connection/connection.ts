import {CommandInterface} from "../../common/commands";
import {getDefaultConnectOptions} from "../../common/ConnectionOptions";
import {commandServer, config} from "../init";
import {SlidersIPC} from "../ipc/sliders";
import {TerminalIPC} from "../ipc/terminal";
import {media_state} from "../media/media_player";
import {BootloadableConnection} from "./bootloader/bootloadable_connection";
import {Bootloading} from "./state/Bootloading";
import {Connecting} from "./state/Connecting";
import {IConnectionState} from "./state/IConnectionState";
import {Idle} from "./state/Idle";
import {TerminalHandle, UD3Connection} from "./types/UD3Connection";

export let connectionState: IConnectionState = new Idle();

export const commands = new CommandInterface(
    async (c: string) => {
        try {
            if (commandServer) {
                commandServer.sendTelnet(Buffer.from(c));
            }
            if (hasUD3Connection()) {
                await getUD3Connection().sendTelnet(Buffer.from(c), getAutoTerminal());
            }
        } catch (x) {
            console.log("Error while sending: ", x);
        }
    },
    () => {
        // \033=\u1B
        TerminalIPC.print('\u001B[2J\u001B[0;0H');
    },
    SlidersIPC.setRelativeOntime,
);

export async function startConf() {
    await commands.sendCommand('\r');
    await SlidersIPC.setAbsoluteOntime(0);
    await commands.setBPS(SlidersIPC.state.bps);
    await commands.setBurstOntime(SlidersIPC.state.burstOntime);
    await commands.setBurstOfftime(SlidersIPC.state.burstOfftime);
    await getUD3Connection().setSynthByFiletype(media_state.type, false);
    await commands.resetKill();
    await commands.startTelemetry();
}

export async function pressButton(window: object) {
    connectionState = await connectionState.pressButton(window);
}

export function autoConnect() {
    console.assert(connectionState instanceof Idle);
    const autoconnect_options = getDefaultConnectOptions(true, config);
    if (autoconnect_options) {
        connectionState = new Connecting(Idle.connectWithOptions(autoconnect_options), new Idle());
    }
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

let lastButton: string;

export function updateFast(): boolean {
    connectionState = connectionState.tickFast();
    const newButton = connectionState.getButtonText();
    const ret = newButton !== lastButton;
    lastButton = newButton;
    return ret;
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

