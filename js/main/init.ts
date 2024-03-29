import {TTConfig} from "../common/TTConfig";
import * as connection from "./connection/connection";
import {initAlarms} from "./connection/telemetry/Alarms";
import * as IPC from "./ipc/IPCProvider";
import * as midi from "./midi/midi";
import * as sid from "./sid/sid";
import {loadConfig} from "./TTConfigLoader";

export let config: TTConfig;
export const simulated = false;

export function init() {
    config = loadConfig("config.ini");
    IPC.init();
    initAlarms();
    setInterval(tick200, 200);
    setInterval(tick20, 20);
    setInterval(tick10, 10);
    connection.autoConnect().catch(e => console.log('During autoconnect', e));
}

function tick200() {
    connection.updateSlow();
}

function tick20() {
    sid.update();
    midi.update();
}

function tick10() {
    connection.updateFast();
}
