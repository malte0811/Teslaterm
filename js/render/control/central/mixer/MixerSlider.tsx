import {TTComponent} from "../../../TTComponent";

export interface MixerSliderProps {
    title: string;
    setValue: (val: number) => any;
    value: number;
}

export class MixerSlider extends TTComponent<MixerSliderProps, {}> {
    public render() {
        return <div className={'tt-mixer-slider-outer-box'}>
            <div className={'tt-mixer-slider-box'}>
                <input
                    className={'tt-vertical-slider'}
                    type={'range'}
                    min={0}
                    max={100}
                    value={this.props.value}
                    onChange={(e) => this.props.setValue(e.target.valueAsNumber)}
                />

                {this.props.title}
            </div>
        </div>;
    }
}
