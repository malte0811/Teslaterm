import React from 'react';
import {CoilID} from "../../../common/constants";
import {getToMainIPCPerCoil, IPC_CONSTANTS_TO_MAIN} from "../../../common/IPCConstantsToMain";
import {getToRenderIPCPerCoil, ISliderState, IUD3State} from "../../../common/IPCConstantsToRenderer";
import {processIPC} from "../../ipc/IPCProvider";
import {TTComponent} from "../../TTComponent";
import {TabControlLevel, TabControlLevelBase} from "../SingleCoilTab";
import {MidiSourceSelect} from "./MidiSourceSelect";
import {OntimeSlider} from './OntimeSlider';
import {SimpleSlider} from './SimpleSlider';

export interface SlidersProps {
    disabled: boolean;
    enableMIDI: boolean;
    darkMode: boolean;
    level: TabControlLevelBase<{ coil: CoilID, ud3State: IUD3State }, {}>;
}

interface SliderUIState extends ISliderState {
    controllingRelativeOntime: boolean;
}

export class Sliders extends TTComponent<SlidersProps, SliderUIState> {
    constructor(props: any) {
        super(props);
        this.state = {
            bps: 20,
            burstOfftime: 0,
            burstOntime: 500,
            controllingRelativeOntime: false,
            maxBPS: 1000,
            maxOntime: 400,
            onlyMaxOntimeSettable: false,
            ontimeAbs: 0,
            ontimeRel: this.props.level.level === 'central-control' ? 0 : 100,
        };
    }

    public componentDidMount() {
        if (this.props.level.level !== 'central-control') {
            this.addIPCListener(
                getToRenderIPCPerCoil(this.props.level.coil).sliders.syncSettings,
                (sync) => {
                    const newState: SliderUIState = {
                        ...sync,
                        controllingRelativeOntime: this.state.controllingRelativeOntime,
                    };
                    if (sync.onlyMaxOntimeSettable) {
                        newState.controllingRelativeOntime = false;
                    }
                    this.setState(newState);
                },
            );
        }
    }

    public render(): React.ReactNode {
        // TODO make this work properly in the central tab
        const coilIPC = this.props.level.level !== 'central-control' ?
            getToMainIPCPerCoil(this.props.level.coil) :
            undefined;
        const combinedIPC = coilIPC ? coilIPC : IPC_CONSTANTS_TO_MAIN;
        const setOntime = (val: number, relative: boolean) => {
            const channel = relative ?
                IPC_CONSTANTS_TO_MAIN.sliders.setOntimeRelative :
                coilIPC.sliders.setOntimeAbsolute;
            processIPC.send(channel, val);
            if (relative) {
                this.setState({ontimeRel: val});
            } else {
                this.setState({ontimeAbs: val});
            }
        };
        const [busOn, trOn] = (() => {
            if (this.props.level.level === 'central-control') {
                return [true, true];
            } else {
                 const udState = this.props.level.ud3State;
                 const busOn = udState.busActive || udState.busControllable;
                 return [busOn, busOn && udState.transientActive];
            }
        })();
        return <div className={'tt-sliders-container'}>
            <OntimeSlider
                max={this.state.maxOntime}
                valueAbsolute={this.state.ontimeAbs}
                valueRelative={this.state.ontimeRel}
                setValue={setOntime}
                relativeAllowed={!this.state.onlyMaxOntimeSettable}
                visuallyEnabled={busOn}
                disabled={this.props.disabled}
                controllingRelative={this.state.controllingRelativeOntime}
                setControllingRelative={b => this.setState({controllingRelativeOntime: b})}
                level={this.props.level}
            />
            <SimpleSlider
                title={'BPS'}
                unit={'/ second'}
                value={this.state.bps}
                min={20}
                max={this.state.maxBPS}
                setValue={(v) => {
                    this.setState({bps: v});
                    processIPC.send(combinedIPC.sliders.setBPS, v);
                }}
                visuallyEnabled={trOn}
                disabled={this.props.disabled || this.state.onlyMaxOntimeSettable}
            />
            <SimpleSlider
                title={'Burst Ontime'}
                unit={'ms'}
                value={this.state.burstOntime}
                min={0}
                max={1000}
                setValue={(v) => {
                    this.setState({burstOntime: v});
                    processIPC.send(combinedIPC.sliders.setBurstOntime, v);
                }}
                visuallyEnabled={trOn}
                disabled={this.props.disabled || this.state.onlyMaxOntimeSettable}
            />
            <SimpleSlider
                title={'Burst Offtime'}
                unit={'ms'}
                value={this.state.burstOfftime}
                min={0}
                max={1000}
                setValue={(v) => {
                    this.setState({burstOfftime: v});
                    processIPC.send(combinedIPC.sliders.setBurstOfftime, v);
                }}
                visuallyEnabled={trOn}
                disabled={this.props.disabled || this.state.onlyMaxOntimeSettable}
            />
            {this.props.enableMIDI && <MidiSourceSelect darkMode={this.props.darkMode}/>}
        </div>;
    }
}
