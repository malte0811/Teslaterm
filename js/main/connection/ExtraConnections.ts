import {AdvancedOptions} from "../../common/Options";
import {MidiServer} from "../midi/MidiServer";
import {NetworkSIDServer} from "../sid/NetworkSIDServer";

export class ExtraConnections {
    private readonly midiServer?: MidiServer;
    private readonly sidServer?: NetworkSIDServer;

    public constructor(options: AdvancedOptions) {
        if (options.midiOptions.runMidiServer) {
            this.midiServer = new MidiServer(options.midiOptions);
        }
        if (options.netSidOptions.enabled) {
            this.sidServer = new NetworkSIDServer(options.netSidOptions.port);
        }
    }

    public tickSlow() {}

    public close() {
        if (this.midiServer) {
            this.midiServer.close();
        }
        if (this.sidServer) {
            this.sidServer.close();
        }
    }
}
