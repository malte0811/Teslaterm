import {CoilID} from "../../common/constants";
import {getToMainIPCPerCoil} from "../../common/IPCConstantsToMain";
import {processIPC} from "./IPCProvider";

class CommandsIPC {
    private coil: CoilID;

    constructor(coil: CoilID) {
        this.coil = coil;
    }

    public saveEEPROM() {
        processIPC.send(getToMainIPCPerCoil(this.coil).commands.saveEEPROM, undefined);
    }

    public sendManualCommand(cmd: string) {
        processIPC.send(getToMainIPCPerCoil(this.coil).manualCommand, cmd);
    }
}

export function commands(coil: CoilID) {
    return new CommandsIPC(coil);
}
