import {AdvancedOptions} from "../../common/Options";
import {BehringerXTouch} from "../media/PhysicalMixer";
import {MidiServer} from "../midi/MidiServer";
import {NetworkSIDServer} from "../sid/NetworkSIDServer";

export class ExtraConnections {
    private readonly midiServer?: MidiServer;
    private readonly sidServer?: NetworkSIDServer;
    private readonly physicalMixer?: BehringerXTouch;

    public constructor(options: AdvancedOptions) {
        if (options.midiOptions.runMidiServer) {
            this.midiServer = new MidiServer(options.midiOptions);
        }
        if (options.netSidOptions.enabled) {
            this.sidServer = new NetworkSIDServer(options.netSidOptions.port);
        }
        if (options.mixerOptions.enable) {
            this.physicalMixer = new BehringerXTouch(options.mixerOptions);
        }
    }

    public getPhysicalMixer() {
        return this.physicalMixer;
    }

    public close() {
        this.midiServer?.close();
        this.sidServer?.close();
        this.physicalMixer?.close();
    }
}
