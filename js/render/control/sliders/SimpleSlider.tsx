import React from 'react';

interface SimpleSliderPropsBase {
    min: number;
    max: number;
    value: number;
    setValue: (val: number) => any;
    visuallyEnabled: boolean;
    step?: number;
    disabled?: boolean;
}

export interface SimpleSliderPropsFixedTitle extends SimpleSliderPropsBase {
    title: string;
}

export interface SimpleSliderProps extends SimpleSliderPropsBase {
    title: string;
    unit: string;
    displayMultiplier?: number;
}

export function SimpleSliderFixedTitle(props: SimpleSliderPropsFixedTitle): React.ReactNode {
    return <div className={'tt-slider-container'}>
        {props.title}<br/>
        <input
            className={props.visuallyEnabled ? 'tt-slider' : 'tt-slider-gray'}
            type={'range'}
            min={props.min}
            max={props.max}
            value={props.value}
            step={props.step ?? 1}
            onChange={(e) => props.setValue(e.target.valueAsNumber)}
            disabled={props.disabled !== undefined && props.disabled}
        />
    </div>;
}

export function SimpleSlider(props: SimpleSliderProps) {
    const title = props.title + ': ' + (props.value * (props.displayMultiplier ?? 1)) + ' ' + props.unit;
    const fixedTitleProps = {...props, title};
    return <SimpleSliderFixedTitle {...fixedTitleProps}/>;
}
