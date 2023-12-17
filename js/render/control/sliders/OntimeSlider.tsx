import React from "react";
import {IPC_CONSTANTS_TO_MAIN} from "../../../common/IPCConstantsToMain";
import {MultiWindowIPC} from "../../../main/ipc/IPCProvider";
import {TTComponent} from "../../TTComponent";
import {TabControlLevel} from "../SingleCoilTab";

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
    level: TabControlLevel;
}

export class OntimeSlider extends TTComponent<OntimeSliderProps, {}> {
    constructor(props: OntimeSliderProps) {
        super(props);
    }

    public render(): React.ReactNode {
        const totalOntime = this.props.valueAbsolute * (this.props.valueRelative / 100);
        let desc: React.JSX.Element;
        let relative: boolean;
        if (this.props.level.level === 'central-control' ) {
            relative = true;
            desc = <span>{this.props.valueRelative}%</span>;
        } else {
            relative = this.props.level.level !== 'single-coil' && this.props.controllingRelative;
            desc = <span>{this.props.valueAbsolute} µs</span>;
            let innerDesc: React.JSX.Element;
            if (this.props.level.level === 'single-coil') {
                innerDesc = <span>{this.props.valueRelative}% of {this.props.valueAbsolute} µs</span>;
            } else if (relative) {
                innerDesc = <span><b>{this.props.valueRelative}%</b> of {this.props.valueAbsolute} µs</span>;
            } else {
                innerDesc = <span>{this.props.valueRelative}% of <b>{this.props.valueAbsolute} µs</b></span>;
            }
            desc = <>{totalOntime.toFixed()} µs ({innerDesc})</>;
        }
        let relativeControl: React.JSX.Element;
        if (this.props.level.level === 'combined') {
            relativeControl = <>
                <input
                    id={'enable-relative-ontime'}
                    type={'checkbox'}
                    disabled={!this.props.relativeAllowed}
                    onChange={(e) => this.props.setControllingRelative(e.target.checked)}
                    checked={relative}
                /><label htmlFor={'enable-relative-ontime'}>Relative</label>
            </>;
        } else {
            relativeControl = <></>;
        }
        return <div className={'tt-slider-container'}>
            Ontime: {desc}<br/>
            <input
                className={this.props.visuallyEnabled ? 'tt-slider' : 'tt-slider-gray'}
                type={'range'}
                min={0}
                max={relative ? 100 : this.props.max}
                value={relative ? this.props.valueRelative : this.props.valueAbsolute}
                onChange={(e) => this.props.setValue(e.target.valueAsNumber, relative)}
                disabled={this.props.disabled}
            /><br/>
            {relativeControl}
        </div>;
    }
}

export function registerCommonSliderIPC(processIPC: MultiWindowIPC) {
    processIPC.distributeTo(IPC_CONSTANTS_TO_MAIN.sliders.setBPS, (c) => c.sliders.setBPS);
    processIPC.distributeTo(IPC_CONSTANTS_TO_MAIN.sliders.setBurstOfftime, (c) => c.sliders.setBurstOfftime);
    processIPC.distributeTo(IPC_CONSTANTS_TO_MAIN.sliders.setBurstOntime, (c) => c.sliders.setBurstOntime);
    processIPC.distributeTo(IPC_CONSTANTS_TO_MAIN.sliders.setOntimeRelative, (c) => c.sliders.setOntimeRelative);
}
