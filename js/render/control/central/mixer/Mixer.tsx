import React from "react";
import {Button} from "react-bootstrap";
import {CoilID} from "../../../../common/constants";
import {IPC_CONSTANTS_TO_MAIN} from "../../../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER, VoiceID} from "../../../../common/IPCConstantsToRenderer";
import {processIPC} from "../../../ipc/IPCProvider";
import {TTComponent} from "../../../TTComponent";
import {CoilState} from "../../MainScreen";
import {InstrumentChoice, MixerColumn} from "./MixerColumn";

export interface MixerProps {
    darkMode: boolean;
    coils: CoilState[];
}

type MixerLayer = CoilID | 'coilMaster' | 'voiceMaster';

interface MixerState {
    // All volumes in percent (0-100)
    masterVolume: number;
    coilVolume: Map<CoilID, number>;
    voiceVolume: Map<VoiceID, number>;
    voiceProgram: Map<VoiceID, number>;
    specificVolumes: Map<CoilID, Map<VoiceID, number>>;
    currentLayer: MixerLayer;
    voices: VoiceID[];
    availablePrograms: string[];
}

export class Mixer extends TTComponent<MixerProps, MixerState> {
    public constructor(props: MixerProps) {
        super(props);
        this.state = {
            availablePrograms: [],
            coilVolume: new Map<CoilID, number>(),
            currentLayer: 'coilMaster',
            masterVolume: 100,
            specificVolumes: new Map<CoilID, Map<VoiceID, number>>(),
            voiceProgram: new Map<CoilID, number>(),
            voiceVolume: new Map<CoilID, number>(),
            voices: [],
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
    }

    public render() {
        let sliders: React.JSX.Element[];
        const layer = this.state.currentLayer;
        if (layer === 'coilMaster') {
            sliders = this.props.coils.map(state => <MixerColumn
                title={state.name || 'Unknown'}
                setValue={(volume) => this.setCoilVolume(state.id, volume)}
                value={this.getCoilVolume(state.id)}
            />);
        } else if (layer === 'voiceMaster') {
            sliders = this.makeVoiceSliders(
                (id) => this.getVoiceVolume(id),
                (id, vol) => this.setVoiceVolume(id, vol),
            );
        } else {
            sliders = this.makeVoiceSliders(
                (id) => this.getSpecificVolume(layer, id),
                (id, vol) => this.setSpecificVolume(layer, id, vol),
            );
        }
        return <div className={'tt-mixer'}>
            <div className={'tt-mixer-border-box'}>
                {...sliders}
            </div>
            <div style={{flex: '1 0 auto'}}/>
            <div className={'tt-mixer-border-box'}>
                <MixerColumn
                    title={'Master'}
                    setValue={(val) => this.setState({masterVolume: val})}
                    value={this.state.masterVolume}
                />
            </div>
            <div className={'tt-mixer-selector'}>
                {this.makeLayerButton('coilMaster', "By Coil")}
                {this.makeLayerButton('voiceMaster', "By Voice")}
                {...this.props.coils.map((coil) => this.makeLayerButton(coil.id, coil.name || 'Unknown'))}
            </div>
        </div>;
    }

    private getCoilVolume(coil: CoilID) {
        if (this.state.coilVolume.has(coil)) {
            return this.state.coilVolume.get(coil);
        } else {
            return 100;
        }
    }

    private setCoilVolume(coil: CoilID, volume: number) {
        this.setState((oldState) => {
            const newCoilVolumes = new Map<CoilID, number>(oldState.coilVolume);
            newCoilVolumes.set(coil, volume);
            return {coilVolume: newCoilVolumes};
        });
    }

    private getVoiceVolume(voice: VoiceID) {
        if (this.state.voiceVolume.has(voice)) {
            return this.state.voiceVolume.get(voice);
        } else {
            return 100;
        }
    }

    private setVoiceVolume(voice: VoiceID, volume: number) {
        this.setState((oldState) => {
            const newVoiceVolumes = new Map<VoiceID, number>(oldState.voiceVolume);
            newVoiceVolumes.set(voice, volume);
            return {voiceVolume: newVoiceVolumes};
        });
    }

    private getSpecificVolume(coil: CoilID, voice: VoiceID) {
        if (this.state.specificVolumes.has(coil)) {
            const submap = this.state.specificVolumes.get(coil);
            if (submap.has(voice)) {
                return submap.get(voice);
            }
        }
        return 100;
    }

    private setSpecificVolume(coil: CoilID, voice: VoiceID, volume: number) {
        this.setState((oldState) => {
            const newMap = new Map<CoilID, Map<VoiceID, number>>(oldState.specificVolumes);
            const newSubmap = new Map<VoiceID, number>(newMap.get(coil));
            newSubmap.set(voice, volume);
            newMap.set(coil, newSubmap);
            return {specificVolumes: newMap};
        });
    }

    private setProgram(voice: VoiceID, program: number) {
        this.setState((oldState) => {
            const newPrograms = new Map<VoiceID, number>(oldState.voiceProgram);
            newPrograms.set(voice, program);
            return {voiceProgram: newPrograms};
        });
        processIPC.send(IPC_CONSTANTS_TO_MAIN.centralTab.setMIDIProgramOverride, [voice, program]);
    }

    private makeVoiceSliders(getVolume: (id: VoiceID) => number, setVolume: (id: VoiceID, volume: number) => any) {
        return this.state.voices.map((i) => {
            const program: InstrumentChoice = {
                available: this.state.availablePrograms,
                currentChoice: this.state.voiceProgram.get(i) || 0,
                setValue: (val) => this.setProgram(i, val),
            };
            return <MixerColumn
                title={`Voice ${i}`}
                setValue={(volume) => setVolume(i, volume)}
                value={getVolume(i)}
                program={program}
            />;
        });
    }

    private makeLayerButton(layer: MixerLayer, text: string) {
        return <Button
            onClick={() => this.setState({currentLayer: layer})}
            style={{width: '100%'}}
            disabled={this.state.currentLayer === layer}
        >{text}</Button>;
    }
}
