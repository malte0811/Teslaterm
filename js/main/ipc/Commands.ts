import {CoilID} from "../../common/constants";
import {
    getToMainIPCPerCoil,
    IPC_CONSTANTS_TO_MAIN,
    IPCToMainKey,
    PerCoilMainIPCs,
} from "../../common/IPCConstantsToMain";
import {BoolOptionCommand, setBoolOption} from "../command/CommandMessages";
import {forEachCoil, getCoilCommands} from "../connection/connection";
import {MultiWindowIPC} from "./IPCProvider";

export class CommandIPC {
    constructor(processIPC: MultiWindowIPC, coil: CoilID) {
        const commands = getCoilCommands(coil);
        const channels = getToMainIPCPerCoil(coil);
        processIPC.onAsync(channels.commands.saveEEPROM, () => commands.eepromSave());
        processIPC.onAsync(
            channels.commands.setBusState,
            ($, enable) => setBoolOption(coil, BoolOptionCommand.bus, enable),
        );
        processIPC.onAsync(
            channels.commands.setKillState,
            ($, enable) => setBoolOption(coil, BoolOptionCommand.kill, enable),
        );
        processIPC.onAsync(
            channels.commands.setTRState,
            ($, enable) => setBoolOption(coil, BoolOptionCommand.transient, enable),
        );
        processIPC.onAsync(channels.commands.setParms, async ($, parms) => {
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
