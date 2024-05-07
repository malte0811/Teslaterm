import React from "react";
import {Button} from "react-bootstrap";
import {CoilID} from "../../../../common/constants";
import {IPC_CONSTANTS_TO_MAIN} from "../../../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER, VoiceID} from "../../../../common/IPCConstantsToRenderer";
import {DEFAULT_MIXER_LAYER, MixerLayer, VolumeKey, VolumeMap} from "../../../../common/VolumeMap";
import {processIPC} from "../../../ipc/IPCProvider";
import {TTComponent} from "../../../TTComponent";
import {CoilState} from "../../MainScreen";
import {InstrumentChoice, MixerColumn} from "./MixerColumn";

export interface MixerProps {
    darkMode: boolean;
    coils: CoilState[];
}

interface MixerState {
    volumes: VolumeMap;
    voiceProgram: Map<VoiceID, number>;
    currentLayer: MixerLayer;
    voices: VoiceID[];
    availablePrograms: string[];
}

export class Mixer extends TTComponent<MixerProps, MixerState> {
    public constructor(props: MixerProps) {
        super(props);
        this.state = {
            availablePrograms: [],
            currentLayer: DEFAULT_MIXER_LAYER,
            voiceProgram: new Map<CoilID, number>(),
            voices: [],
            volumes: new VolumeMap(),
        };
    }

    public componentDidMount() {
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.centralTab.setMediaChannels,
            (voices) => this.setState({voices}),
        );
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.centralTab.setAvailableMIDIPrograms,
            (availablePrograms) => this.setState({availablePrograms}),
        );
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.centralTab.setMIDIProgramsByChannel,
            (voiceProgram) => this.setState({voiceProgram}),
        );
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.centralTab.setMixerLayer, (layer) => this.setState({currentLayer: layer}),
        );
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.centralTab.setVolume,
            ([key, volume]) => this.setState((oldState) => ({volumes: oldState.volumes.with(key, volume)})),
        );
    }

    public render() {
        let sliders: React.JSX.Element[];
        const layer = this.state.currentLayer;
        if (layer === 'coilMaster') {
            sliders = this.props.coils.map(state => <MixerColumn
                title={state.name || 'Unknown'}
                setValue={(volume) => this.setVolume({coil: state.id}, volume)}
                value={this.getVolume({coil: state.id})}
            />);
        } else if (layer === 'voiceMaster') {
            sliders = this.makeVoiceSliders(undefined);
        } else {
            sliders = this.makeVoiceSliders(layer);
        }
        return <div className={'tt-mixer'}>
            <div className={'tt-mixer-border-box'}>
                {...sliders}
            </div>
            <div style={{flex: '1 0 auto'}}/>
            <div className={'tt-mixer-border-box'}>
                <MixerColumn
                    title={'Master'}
                    setValue={(val) => this.setVolume({}, val)}
                    value={this.getVolume({})}
                />
            </div>
            <div className={'tt-mixer-selector'}>
                {this.makeLayerButton('coilMaster', "By Coil")}
                {this.makeLayerButton('voiceMaster', "By Voice")}
                {...this.props.coils.map((coil) => this.makeLayerButton(coil.id, coil.name || 'Unknown'))}
            </div>
        </div>;
    }

    private getVolume(key: VolumeKey) {
        return this.state.volumes.getIndividualVolume(key);
    }

    private setVolume(key: VolumeKey, volume: number) {
        this.setState((oldState) => ({volumes: oldState.volumes.with(key, volume)}));
        processIPC.send(IPC_CONSTANTS_TO_MAIN.centralTab.setVolume, [key, volume]);
    }

    private setProgram(voice: VoiceID, program: number) {
        this.setState((oldState) => {
            const newPrograms = new Map<VoiceID, number>(oldState.voiceProgram);
            newPrograms.set(voice, program);
            return {voiceProgram: newPrograms};
        });
        processIPC.send(IPC_CONSTANTS_TO_MAIN.centralTab.setMIDIProgramOverride, [voice, program]);
    }

    private makeVoiceSliders(coil?: CoilID) {
        return this.state.voices.map((i) => {
            const program: InstrumentChoice = {
                available: this.state.availablePrograms,
                currentChoice: this.state.voiceProgram.get(i) || 0,
                setValue: (val) => this.setProgram(i, val),
            };
            return <MixerColumn
                title={`Voice ${i}`}
                setValue={(volume) => this.setVolume({voice: i, coil}, volume)}
                value={this.getVolume({voice: i, coil})}
                program={program}
            />;
        });
    }

    private makeLayerButton(layer: MixerLayer, text: string) {
        return <Button
            onClick={() => {
                this.setState({currentLayer: layer});
                processIPC.send(IPC_CONSTANTS_TO_MAIN.centralTab.setMixerLayer, layer);
            }}
            style={{width: '100%'}}
            disabled={this.state.currentLayer === layer}
        >{text}</Button>;
    }
}
