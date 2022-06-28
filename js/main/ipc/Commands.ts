import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {commands} from "../connection/connection";
import {MultiWindowIPC} from "./IPCProvider";

export class CommandIPC {
    constructor(processIPC: MultiWindowIPC) {
        processIPC.onAsync(IPC_CONSTANTS_TO_MAIN.commands.saveEEPROM, () => commands.eepromSave());
        this.registerSwitch(processIPC, IPC_CONSTANTS_TO_MAIN.commands.setBusState, commands.busOn, commands.busOff);
        this.registerSwitch(
            processIPC, IPC_CONSTANTS_TO_MAIN.commands.setKillState, commands.setKill, commands.resetKill,
        );
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.commands.setTRState, ($, enable) => commands.setTransientEnabled(enable),
        );
        processIPC.onAsync(IPC_CONSTANTS_TO_MAIN.commands.setParms, async ($, parms) => {
            for (const [key, value] of parms[0]) {
                await commands.setParam(key, value);
            }
        });
    }

    private registerSwitch(
        processIPC: MultiWindowIPC, channel: string, onTrue: () => Promise<any>, onFalse: () => Promise<any>,
    ) {
        processIPC.onAsync(channel, ($, enable) => {
            if (enable) {
                return onTrue.call(commands);
            } else {
                return onFalse.call(commands);
            }
        });
    }
}
