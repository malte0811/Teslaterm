import React from "react";
import {IPC_CONSTANTS_TO_MAIN} from "../../../common/IPCConstantsToMain";
import {processIPC} from "../../ipc/IPCProvider";
import {TTComponent} from "../../TTComponent";

export interface OntimeSliderProps {
    max: number;
    valueAbsolute: number;
    valueRelative: number;
    setValue: (val: number, relative: boolean) => any;
    relativeAllowed: boolean;
    relativeIsDefault: boolean;
    // Gray out the slider, but do not actually stop the user from interacting. Indicates that changing the value
    // probably does not affect the coil right now, but might when the coil is turned on.
    visuallyEnabled: boolean;
    // Do not allow interaction with the slider; we don't have a connection to the UD3
    disabled: boolean;
    controllingRelative: boolean;
    setControllingRelative: (val: boolean) => any;
}

export class OntimeSlider extends TTComponent<OntimeSliderProps, {}> {
    constructor(props: OntimeSliderProps) {
        super(props);
    }

    render(): React.ReactNode {
        const totalOntime = this.props.valueAbsolute * (this.props.valueRelative / 100);
        let desc: JSX.Element;
        if (this.props.controllingRelative) {
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
                max={this.props.controllingRelative ? 100 : this.props.max}
                value={this.props.controllingRelative ? this.props.valueRelative : this.props.valueAbsolute}
                onChange={(e) => this.props.setValue(e.target.valueAsNumber, this.props.controllingRelative)}
                disabled={this.props.disabled}
            /><br/>
            <input
                id={'enable-relative-ontime'}
                type={'checkbox'}
                disabled={!this.props.relativeAllowed}
                onChange={(e) => this.props.setControllingRelative(e.target.checked)}
                checked={this.props.controllingRelative}
            />
            <label htmlFor={'enable-relative-ontime'}>Relative</label>
        </div>;
    }
}
