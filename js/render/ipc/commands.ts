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

class CommandsIPC {
    public saveEEPROM() {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.commands.saveEEPROM);
    }

    public setBusState(enabled: boolean) {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.commands.setBusState, enabled);
    }

    public setKillState(killSet: boolean) {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.commands.setKillState, killSet);
    }

    public setParms(parms: Map<string, string>) {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.commands.setParms, parms);
    }

    public setTransientEnabled(enabled: boolean) {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.commands.setTRState, enabled);
    }
}

export const commands = new CommandsIPC();
