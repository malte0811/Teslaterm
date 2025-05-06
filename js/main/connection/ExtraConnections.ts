import {AdvancedOptions} from "../../common/Options";
import {MixerState} from "../media/mixer/MixerState";
import {MidiServer} from "../midi/MidiServer";
import {NetworkSIDServer} from "../sid/NetworkSIDServer";

export class ExtraConnections {
    private readonly midiServer?: MidiServer;
    private readonly sidServer?: NetworkSIDServer;
    private readonly mixer: MixerState;
    private readonly multicoil: boolean;

    public constructor(options: AdvancedOptions, multicoil: boolean) {
        if (options.midiOptions.runMidiServer) {
            this.midiServer = new MidiServer(options.midiOptions);
        }
        if (options.netSidOptions.enabled) {
            this.sidServer = new NetworkSIDServer(options.netSidOptions.port);
        }
        this.mixer = new MixerState(options.mixerOptions);
        this.multicoil = multicoil;
    }

    public getMixer() {
        return this.mixer;
    }

    public isMulticoil() {
        return this.multicoil;
    }

    public close() {
        this.midiServer?.close();
        this.sidServer?.close();
        this.mixer.close();
    }
}
