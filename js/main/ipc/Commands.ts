import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {BoolOptionCommand, setBoolOption} from "../command/CommandMessages";
import {commands} from "../connection/connection";
import {MultiWindowIPC} from "./IPCProvider";

export class CommandIPC {
    constructor(processIPC: MultiWindowIPC) {
        processIPC.onAsync(IPC_CONSTANTS_TO_MAIN.commands.saveEEPROM, () => commands.eepromSave());
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.commands.setBusState, ($, enable) => setBoolOption(BoolOptionCommand.bus, enable),
        );
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.commands.setKillState, ($, enable) => setBoolOption(BoolOptionCommand.kill, enable),
        );
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.commands.setTRState,
            ($, enable) => setBoolOption(BoolOptionCommand.transient, enable),
        );
        processIPC.onAsync(IPC_CONSTANTS_TO_MAIN.commands.setParms, async ($, parms) => {
            for (const [key, value] of parms) {
                await commands.setParam(key, value);
            }
        });
    }
}
