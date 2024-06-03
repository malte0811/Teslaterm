import {AdvancedOptions, PhysicalMixerType} from "../../common/Options";
import {BehringerXTouch} from "../media/PhysicalMixer";
import {MidiServer} from "../midi/MidiServer";
import {NetworkSIDServer} from "../sid/NetworkSIDServer";

export class ExtraConnections {
    private readonly midiServer?: MidiServer;
    private readonly sidServer?: NetworkSIDServer;
    private readonly physicalMixer?: BehringerXTouch;
    private readonly multicoil: boolean;

    public constructor(options: AdvancedOptions, multicoil: boolean) {
        if (options.midiOptions.runMidiServer) {
            this.midiServer = new MidiServer(options.midiOptions);
        }
        if (options.netSidOptions.enabled) {
            this.sidServer = new NetworkSIDServer(options.netSidOptions.port);
        }
        switch (options.mixerOptions.type) {
            case PhysicalMixerType.none:
                this.physicalMixer = undefined;
                break;
            case PhysicalMixerType.behringer_x_touch:
                this.physicalMixer = new BehringerXTouch(options.mixerOptions);
                break;
        }
        this.multicoil = multicoil;
    }

    public getPhysicalMixer() {
        return this.physicalMixer;
    }

    public isMulticoil() {
        return this.multicoil;
    }

    public close() {
        this.midiServer?.close();
        this.sidServer?.close();
        this.physicalMixer?.close();
    }
}
