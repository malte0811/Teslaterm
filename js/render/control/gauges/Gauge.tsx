import React from "react";
import 'justgage/dist/justgage'
import {MeterConfig} from "../../../common/IPCConstantsToRenderer";
import {TTComponent} from "../../TTComponent";

export interface GaugeProps {
    value: number;
    config: MeterConfig;
    darkMode: boolean;
}

const DARK_GAUGE_PROPS = {
    gaugeColor: '#575757',
    labelFontColor: 'white',
    valueFontColor: 'white',
};

export class Gauge extends TTComponent<GaugeProps, {}> {
    private static nextId: number = 0;
    private readonly id: string;
    private gauge?: JustGage;
    private readonly ref: React.RefObject<HTMLDivElement>;
    private observer?: ResizeObserver;

    public constructor(props: any) {
        super(props);
        this.id = "tt-gauge-" + Gauge.nextId;
        ++Gauge.nextId;
        this.ref = React.createRef();
    }

    public componentDidMount() {
        this.reInit();
        if (this.ref.current) {
            this.observer = new ResizeObserver( () => this.reInit());
            this.observer.observe(this.ref.current);
        }
    }

    public componentDidUpdate() {
        if (!this.ref.current || this.ref.current.offsetHeight < 10 || this.ref.current.offsetWidth < 10) {
            return;
        }
        if (this.gauge) {
            const newConfig = this.props.config;
            const oldConfig = this.gauge.config;
            const configChanged = newConfig.min !== oldConfig.min ||
                newConfig.max !== oldConfig.max ||
                newConfig.name !== oldConfig.label;
            if (configChanged) {
                this.gauge.refresh(
                    this.props.value, this.props.config.max, this.props.config.min, this.props.config.name,
                );
            } else if (this.props.value !== this.gauge.config.value) {
                this.gauge.refresh(this.props.value);
            }
        }
    }

    public componentWillUnmount() {
        super.componentWillUnmount();
        if (this.gauge) {
            (this.gauge as any).destroy();
            this.gauge = undefined;
        }
        if (this.observer) {
            this.observer.unobserve(this.ref.current);
        }
    }

    public render() {
        return <div id={this.id} className={'tt-gauge'} ref={this.ref}/>;
    }

    private reInit() {
        if (this.gauge) {
            (this.gauge as any).destroy();
        }
        this.gauge = new JustGage({
            id: this.id,
            label: this.props.config.name,
            max: this.props.config.max,
            min: this.props.config.min,
            value: this.props.value,
            ...(this.props.darkMode ? DARK_GAUGE_PROPS : {}),
        });
    }
}
