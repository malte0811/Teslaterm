import {CoilID} from "../../common/constants";
import {
    getToMainIPCPerCoil,
    IPC_CONSTANTS_TO_MAIN,
} from "../../common/IPCConstantsToMain";
import {getCoilCommands} from "../connection/connection";
import {MultiWindowIPC} from "./IPCProvider";

export class CommandIPC {
    constructor(processIPC: MultiWindowIPC, coil: CoilID) {
        const commands = getCoilCommands(coil);
        const channels = getToMainIPCPerCoil(coil);
        processIPC.onAsync(channels.commands.saveEEPROM, () => commands.eepromSave());
        processIPC.onAsync(
            channels.commands.setBusState,
            (enable) => enable ? commands.busOn() : commands.busOff(),
        );
        processIPC.onAsync(
            channels.commands.setKillState,
            (enable) => enable ? commands.setKill() : commands.resetKill(),
        );
        processIPC.onAsync(
            channels.commands.setTRState,
            (enable) => commands.setTransientEnabled(enable),
        );
        processIPC.onAsync(channels.commands.setParms, async (parms) => {
            for (const [key, value] of parms) {
                await commands.setParam(key, value);
            }
        });
    }
}

export function registerCommonCommandsIPC(processIPC: MultiWindowIPC) {
    processIPC.distributeTo(IPC_CONSTANTS_TO_MAIN.commands.setAllKillState, (c) => c.commands.setKillState);
    processIPC.distributeTo(IPC_CONSTANTS_TO_MAIN.commands.setBusState, (c) => c.commands.setBusState);
    processIPC.distributeTo(IPC_CONSTANTS_TO_MAIN.commands.setTRState, (c) => c.commands.setTRState);
}
