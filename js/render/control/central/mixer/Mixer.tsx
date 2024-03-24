import {Button} from "react-bootstrap";
import {CoilID} from "../../../../common/constants";
import {TTComponent} from "../../../TTComponent";
import {CoilState} from "../../MainScreen";
import {MixerSlider} from "./MixerSlider";

export interface MixerProps {
    darkMode: boolean;
    coils: CoilState[];
}

// TODO probably move to IPC
export type VoiceID = number;

interface MixerState {
    // All volumes in percent (0-100)
    masterVolume: number;
    coilVolume: Map<CoilID, number>;
    voiceVolume: Map<VoiceID, number>;
    selectingByCoil: boolean;
}

export class Mixer extends TTComponent<MixerProps, MixerState> {
    public constructor(props: MixerProps) {
        super(props);
        this.state = {
            coilVolume: new Map<CoilID, number>(),
            masterVolume: 100,
            selectingByCoil: true,
            voiceVolume: new Map<CoilID, number>(),
        };
    }

    public render() {
        let sliders: JSX.Element[];
        if (this.state.selectingByCoil) {
            sliders = this.props.coils.map(state => <MixerSlider
                title={state.name || 'Unknown'}
                setValue={(volume) => this.setCoilVolume(state.id, volume)}
                value={this.getCoilVolume(state.id)}
            />);
        } else {
            sliders = new Array(8).fill(undefined).map((_, i) => <MixerSlider
                title={`Voice ${i + 1}`}
                setValue={(volume) => this.setVoiceVolume(i, volume)}
                value={this.getVoiceVolume(i)}
            />);
        }
        return <div className={'tt-mixer'}>
            <div className={'tt-mixer-border-box'}>
                {...sliders}
            </div>
            <div style={{flex: '1 0 auto'}}/>
            <div className={'tt-mixer-border-box'}>
                <MixerSlider
                    title={'Master'}
                    setValue={(val) => this.setState({masterVolume: val})}
                    value={this.state.masterVolume}
                />
            </div>
            <div className={'tt-mixer-selector'}>
                <Button
                    onClick={() => this.setState({selectingByCoil: true})}
                    style={{width: '100%'}}
                >By Coil</Button><br/>
                <Button
                    onClick={() => this.setState({selectingByCoil: false})}
                    style={{width: '100%'}}
                >By Voice</Button>
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

    private getVoiceVolume(coil: VoiceID) {
        if (this.state.coilVolume.has(coil)) {
            return this.state.coilVolume.get(coil);
        } else {
            return 100;
        }
    }

    private setVoiceVolume(coil: VoiceID, volume: number) {
        this.setState((oldState) => {
            const newVoiceVolumes = new Map<VoiceID, number>(oldState.coilVolume);
            newVoiceVolumes.set(coil, volume);
            return {coilVolume: newVoiceVolumes};
        });
    }
}
