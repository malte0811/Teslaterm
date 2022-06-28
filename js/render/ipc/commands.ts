import {CommandInterface} from "../../common/commands";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {terminal} from "../gui/constants";
import {processIPC} from "./IPCProvider";

export function sendManualCommand(cmd: string) {
    // TODO async?
    processIPC.send(IPC_CONSTANTS_TO_MAIN.manualCommand, cmd);
}

export const manualCommands = new CommandInterface(
    (c) => {
        sendManualCommand(c);
        return Promise.resolve();
    },
    () => {
        // \033=\u1B
        terminal.io.print('\u001B[2J\u001B[0;0H');
    },
    (val: number) => {
        throw new Error();
    },
);

export const commands = new CommandInterface(
    (c) => {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.automaticCommand, c);
        // TODO?
        return Promise.resolve();
    },
    () => {},
    () => {
        throw new Error();
    },
);
