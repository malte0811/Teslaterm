import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {processIPC} from "./IPCProvider";

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

    public sendManualCommand(cmd: string) {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.manualCommand, cmd);
    }
}

export const commands = new CommandsIPC();
