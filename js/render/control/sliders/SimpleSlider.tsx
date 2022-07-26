import React from 'react';
import {TTComponent} from "../../TTComponent";

export interface SimpleSliderProps {
    title: string;
    unit: string;
    min: number;
    max: number;
    value: number;
    setValue: (val: number) => any;
    visuallyEnabled: boolean;
    disabled: boolean;
}

export class SimpleSlider extends TTComponent<SimpleSliderProps, {}> {
    render(): React.ReactNode {
        return <div className={'tt-slider-container'}>
            {this.props.title + ': ' + this.props.value + ' ' + this.props.unit}<br/>
            <input
                className={this.props.visuallyEnabled ? 'tt-slider' : 'tt-slider-gray'}
                type={'range'}
                min={this.props.min}
                max={this.props.max}
                value={this.props.value}
                onChange={(e) => this.props.setValue(e.target.valueAsNumber)}
                disabled={this.props.disabled}
            />
        </div>;
    }
}
