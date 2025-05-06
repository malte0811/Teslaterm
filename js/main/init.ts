import {TTConfig} from "../common/TTConfig";
import {getMixer} from "./connection/connection";
import * as connection from "./connection/connection";
import {ipcs} from "./ipc/IPCProvider";
import * as IPC from "./ipc/IPCProvider";
import * as midi from "./midi/midi";
import * as sid from "./sid/sid";
import {loadConfig} from "./TTConfigLoader";

export let config: TTConfig;

export function init() {
    config = loadConfig("config.ini");
    IPC.init();
    setInterval(tick200, 200);
    setInterval(tick100, 100);
    setInterval(tick20, 20);
    setInterval(tick10, 10);
}

function tick200() {
    connection.updateSlow();
}

function tick100() {
    ipcs.tick100();
    getMixer()?.tick100();
}

function tick20() {
    sid.update();
    midi.update();
}

function tick10() {
    connection.updateFast();
}
