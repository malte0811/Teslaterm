import React from "react";
import 'justgage/dist/justgage'
import {MeterConfig} from "../../../common/IPCConstantsToRenderer";
import {TTComponent} from "../../TTComponent";

export interface GaugeProps {
    value: number;
    config: MeterConfig;
}

export class Gauge extends TTComponent<GaugeProps, {}> {
    private static nextId: number = 0;
    private readonly id: string;
    private gauge?: any;

    constructor(props: any) {
        super(props);
        this.id = "tt-gauge-" + Gauge.nextId;
        ++Gauge.nextId;
    }

    componentDidMount() {
        this.gauge = new JustGage({
            id: this.id,
            value: this.props.value,
            min: this.props.config.min,
            max: this.props.config.max,
            label: this.props.config.name
        });
    }

    componentDidUpdate() {
        super.componentWillUnmount();
        if (this.gauge) {
            this.gauge.refresh(this.props.value, this.props.config.max, this.props.config.min, this.props.config.name);
        }
    }

    componentWillUnmount() {
        super.componentWillUnmount();
        if (this.gauge) {
            (this.gauge as any).destroy();
        }
    }

    render() {
        return <div id={this.id} className={'tt-gauge'}/>;
    }
}
