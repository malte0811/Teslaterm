import React from 'react';
import {IPC_CONSTANTS_TO_MAIN} from "../../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER, ISliderState, IUD3State} from "../../../common/IPCConstantsToRenderer";
import {processIPC} from "../../ipc/IPCProvider";
import {TTComponent} from "../../TTComponent";
import {MidiSourceSelect} from "./MidiSourceSelect";
import {OntimeSlider} from './OntimeSlider';
import {SimpleSlider} from './SimpleSlider';

export interface SlidersProps {
    ud3State: IUD3State;
    disabled: boolean;
}

export class Sliders extends TTComponent<SlidersProps, ISliderState> {
    constructor(props: any) {
        super(props);
        this.state = {
            bps: 0,
            ontimeAbs: 0,
            ontimeRel: 100,
            burstOfftime: 0,
            burstOntime: 500,
            maxBPS: 1000,
            relativeAllowed: true,
            maxOntime: 400,
        };
    }

    componentDidMount() {
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.sliders.syncSettings, (sync: ISliderState) => this.setState(sync)
        );
    }

    render(): React.ReactNode {
        const setOntime = (val: number, relative: boolean) => {
            const channel = relative ?
                IPC_CONSTANTS_TO_MAIN.sliders.setOntimeRelative :
                IPC_CONSTANTS_TO_MAIN.sliders.setOntimeAbsolute;
            processIPC.send(channel, val);
            if (relative) {
                this.setState({ontimeRel: val});
            } else {
                this.setState({ontimeAbs: val})
            }
        };
        const busOn = this.props.ud3State.busActive || !this.props.ud3State.busControllable;
        const trOn = busOn && this.props.ud3State.transientActive;
        return <div className={'tt-sliders-container'}>
            <OntimeSlider
                max={this.state.maxOntime}
                valueAbsolute={this.state.ontimeAbs}
                valueRelative={this.state.ontimeRel}
                setValue={setOntime}
                relativeAllowed={this.state.relativeAllowed}
                visuallyEnabled={busOn}
                disabled={this.props.disabled}
            />
            <SimpleSlider
                title={'BPS'}
                unit={'/ second'}
                value={this.state.bps}
                min={20}
                max={this.state.maxBPS}
                setValue={(v) => {
                    this.setState({bps: v})
                    processIPC.send(IPC_CONSTANTS_TO_MAIN.sliders.setBPS, v);
                }}
                visuallyEnabled={trOn}
                disabled={this.props.disabled}
            />
            <SimpleSlider
                title={'Burst Ontime'}
                unit={'ms'}
                value={this.state.burstOntime}
                min={0}
                max={1000}
                setValue={(v) => {
                    this.setState({burstOntime: v});
                    processIPC.send(IPC_CONSTANTS_TO_MAIN.sliders.setBurstOntime, v);
                }}
                visuallyEnabled={trOn}
                disabled={this.props.disabled}
            />
            <SimpleSlider
                title={'Burst Offtime'}
                unit={'ms'}
                value={this.state.burstOfftime}
                min={0}
                max={1000}
                setValue={(v) => {
                    this.setState({burstOfftime: v});
                    processIPC.send(IPC_CONSTANTS_TO_MAIN.sliders.setBurstOfftime, v);
                }}
                visuallyEnabled={trOn}
                disabled={this.props.disabled}
            />
            <MidiSourceSelect/>
        </div>;
    }
}
