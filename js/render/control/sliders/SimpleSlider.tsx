import React from 'react';
import {TTComponent} from "../../TTComponent";

interface SimpleSliderPropsBase {
    min: number;
    max: number;
    value: number;
    setValue: (val: number) => any;
    visuallyEnabled: boolean;
    disabled: boolean;
}

export interface SimpleSliderPropsFixedTitle extends SimpleSliderPropsBase {
    title: string;
}

export interface SimpleSliderProps extends SimpleSliderPropsBase {
    title: string;
    unit: string;
}

export class SimpleSliderFixedTitle extends TTComponent<SimpleSliderPropsFixedTitle, {}> {
    public render(): React.ReactNode {
        return <div className={'tt-slider-container'}>
            {this.props.title}<br/>
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

export class SimpleSlider extends TTComponent<SimpleSliderProps, {}> {
    public render(): React.ReactNode {
        const title = this.props.title + ': ' + this.props.value + ' ' + this.props.unit;
        const fixedTitleProps = {...this.props, title};
        return <SimpleSliderFixedTitle {...fixedTitleProps}/>;
    }
}
