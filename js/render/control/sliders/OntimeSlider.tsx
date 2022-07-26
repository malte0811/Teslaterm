import React from "react";
import {IPC_CONSTANTS_TO_MAIN} from "../../../common/IPCConstantsToMain";
import {processIPC} from "../../ipc/IPCProvider";
import {TTComponent} from "../../TTComponent";

interface OntimeSliderState {
    controllingRelative: boolean;
}

export interface OntimeSliderProps {
    max: number;
    valueAbsolute: number;
    valueRelative: number;
    setValue: (val: number, relative: boolean) => any;
    relativeAllowed: boolean;
    // Gray out the slider, but do not actually stop the user from interacting. Indicates that changing the value
    // probably does not affect the coil right now, but might when the coil is turned on.
    visuallyEnabled: boolean;
    // Do not allow interaction with the slider; we don't have a connection to the UD3
    disabled: boolean;
}

export class OntimeSlider extends TTComponent<OntimeSliderProps, OntimeSliderState> {
    constructor(props: any) {
        super(props);
        this.state = {
            controllingRelative: false
        };
    }

    render(): React.ReactNode {
        if (!this.props.relativeAllowed && this.state.controllingRelative) {
            this.setState({controllingRelative: false});
        }
        const totalOntime = this.props.valueAbsolute * (this.props.valueRelative / 100)
        let desc: JSX.Element;
        if (this.state.controllingRelative) {
            desc = <span><b>{this.props.valueRelative}%</b> of {this.props.valueAbsolute} µs</span>;
        } else {
            desc = <span>{this.props.valueRelative}% of <b>{this.props.valueAbsolute} µs</b></span>;
        }
        return <div className={'tt-slider-container'}>
            Ontime: {totalOntime.toFixed()} µs ({desc})<br/>
            <input
                className={this.props.visuallyEnabled ? 'tt-slider' : 'tt-slider-gray'}
                type={'range'}
                min={0}
                max={this.state.controllingRelative ? 100 : this.props.max}
                value={this.state.controllingRelative ? this.props.valueRelative : this.props.valueAbsolute}
                onChange={(e) => this.props.setValue(e.target.valueAsNumber, this.state.controllingRelative)}
                disabled={this.props.disabled}
            /><br/>
            <input
                id={'enable-relative-ontime'}
                type={'checkbox'}
                disabled={!this.props.relativeAllowed}
                onChange={(e) => this.setState({controllingRelative: e.target.checked})}
            />
            <label htmlFor={'enable-relative-ontime'}>Relative</label>
        </div>;
    }
}
