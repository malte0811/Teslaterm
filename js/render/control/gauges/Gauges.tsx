import React from "react";
import {IPC_CONSTANTS_TO_RENDERER, MeterConfig, SetMeters} from "../../../common/IPCConstantsToRenderer";
import {TTComponent} from "../../TTComponent";
import {Gauge, GaugeProps} from "./Gauge";

export const NUM_GAUGES = 7;

export interface GaugesProps {
    darkMode: boolean;
}

interface GaugeState {
    gauges: GaugeProps[];
}

export class Gauges extends TTComponent<GaugesProps, GaugeState> {
    constructor(props: any) {
        super(props);
        const gauges: GaugeProps[] = [];
        for (let i = 0; i < NUM_GAUGES; ++i) {
            gauges.push({
                config: {
                    max: 10,
                    meterId: i,
                    min: 0,
                    name: "Meter " + i,
                    scale: 1,
                },
                darkMode: this.props.darkMode,
                value: 0,
            });
        }
        this.state = {gauges};
    }

    public componentDidMount() {
        this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.meters.configure, (config: MeterConfig) => {
            this.setState((oldState) => {
                const newGauges: GaugeProps[] = [...oldState.gauges];
                newGauges[config.meterId] = {
                    value: newGauges[config.meterId].value,
                    config,
                    darkMode: this.props.darkMode,
                };
                return {gauges: newGauges};
            });
        });
        this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.meters.setValue, (update: SetMeters) => {
            this.setState((oldState) => {
                const newGauges: GaugeProps[] = [...oldState.gauges];
                for (const [id, value] of Object.entries(update.values)) {
                    const config = newGauges[id].config;
                    const scale = config.scale || 1;
                    newGauges[id] = {value: value / scale, config, darkMode: this.props.darkMode};
                }
                return {gauges: newGauges};
            });
        });
    }

    render(): React.ReactNode {
        return <div className={'tt-gauges'}>
            {this.state.gauges.map((p, i) => <Gauge {...p} key={i}/>)}
        </div>;
    }
}
