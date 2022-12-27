import {ToastSeverity} from "../../common/IPCConstantsToRenderer";
import {AdvancedOptions, CommandConnectionConfig} from "../../common/Options";
import {CommandClient} from "../command/CommandClient";
import {ICommandServer, makeCommandServer} from "../command/CommandServer";
import {ipcs} from "../ipc/IPCProvider";
import {MidiServer} from "../midi/MidiServer";
import {NetworkSIDServer} from "../sid/NetworkSIDServer";

export class ExtraConnections {
    private readonly midiServer?: MidiServer;
    private readonly sidServer?: NetworkSIDServer;
    private readonly commandServer: ICommandServer;
    private readonly commandOptions: CommandConnectionConfig;
    private commandClient: CommandClient;

    public constructor(options: AdvancedOptions) {
        if (options.midiOptions.runMidiServer) {
            this.midiServer = new MidiServer(options.midiOptions);
        }
        this.commandServer = makeCommandServer(options.commandOptions);
        this.commandOptions = options.commandOptions;
        if (options.commandOptions.state === "client") {
            this.initCommandClient();
        }
        if (options.netSidOptions.enabled) {
            this.sidServer = new NetworkSIDServer(options.netSidOptions.port, this.commandServer);
        }
    }

    public tickSlow() {
        this.commandServer.tick();
        if (this.commandClient && this.commandClient.tickSlow()) {
            ipcs.misc.openToast(
                "Command server", "Command server timed out, reconnecting", ToastSeverity.warning, 'command-timeout',
            );
            this.initCommandClient();
        }
    }

    public tickFast() {
        if (this.commandClient) {
            this.commandClient.tickFast();
        }
    }

    public close() {
        if (this.midiServer) {
            this.midiServer.close();
        }
        if (this.sidServer) {
            this.sidServer.close();
        }
        this.commandServer.close();
        if (this.commandClient) {
            this.commandClient.close();
        }
    }

    public getCommandServer() {
        return this.commandServer;
    }

    private initCommandClient() {
        this.commandClient = new CommandClient(this.commandOptions.remoteName, this.commandOptions.port);
    }
}
