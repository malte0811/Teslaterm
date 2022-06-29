import {TTConfig} from "../common/TTConfig";
import {CommandClient} from "./command/CommandClient";
import {ICommandServer, makeCommandServer} from "./command/CommandServer";
import * as connection from "./connection/connection";
import {ipcs} from "./ipc/IPCProvider";
import * as IPC from "./ipc/IPCProvider";
import * as midi from "./midi/midi";
import {NetworkSIDServer} from "./sid/NetworkSIDServer";
import * as sid from "./sid/sid";
import {loadConfig} from "./TTConfigLoader";

export let config: TTConfig;
export const simulated = false;
let sidServer: NetworkSIDServer;
let commandClient: CommandClient;
export let commandServer: ICommandServer;

export function init() {
    config = loadConfig("config.ini");
    IPC.init();
    midi.init();
    setInterval(tick200, 200);
    setInterval(tick20, 20);
    setInterval(tick10, 10);
    connection.autoConnect();
    if (config.netsid.enabled) {
        sidServer = new NetworkSIDServer(config.netsid.port);
    }
    commandServer = makeCommandServer();
    if (config.command.state === "client") {
        initCommandClient();
    }
}

function initCommandClient() {
    commandClient = new CommandClient(config.command.remoteName, config.command.port);
}

function tick200() {
    connection.updateSlow();
    commandServer.tick();
    if (commandClient && commandClient.tickSlow()) {
        ipcs.terminal.println("Command server timed out, reconnecting");
        initCommandClient();
    }
}

function tick20() {
    sid.update();
    midi.update();
    if (commandClient) {
        commandClient.tickFast();
    }
}

function tick10() {
    const updateButton = connection.updateFast();
    if (updateButton) {
        ipcs.menu.setConnectionButtonText(connection.connectionState.getButtonText());
    }
}
