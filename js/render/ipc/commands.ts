import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {processIPC} from "./IPCProvider";

class CommandsIPC {
    public saveEEPROM() {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.commands.saveEEPROM, undefined);
    }

    public sendManualCommand(cmd: string) {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.manualCommand, cmd);
    }
}

export const commands = new CommandsIPC();
