import React from "react";
import {IPC_CONSTANTS_TO_RENDERER, MeterConfig, SetMeters} from "../../../common/IPCConstantsToRenderer";
import {IPCListenerRef, processIPC} from "../../ipc/IPCProvider";
import {TTComponent} from "../../TTComponent";
import {Gauge, GaugeProps} from "./Gauge";

export const NUM_GAUGES = 7;

export interface GaugeState {
    gauges: GaugeProps[];
}

export class Gauges extends TTComponent<{}, GaugeState> {
    constructor(props: any) {
        super(props);
        const gauges: GaugeProps[] = [];
        for (let i = 0; i < NUM_GAUGES; ++i) {
            gauges.push({
                value: 0,
                config: new MeterConfig(i, 0, 10, 1, "Meter "+i),
            })
        }
        this.state = {gauges};
    }

    componentDidMount() {
        this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.meters.configure, (config: MeterConfig) => {
            this.setState((oldState) => {
                const newGauges = [...oldState.gauges];
                newGauges[config.meterId] = {value: newGauges[config.meterId].value, config};
                return {gauges: newGauges};
            });
        });
        this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.meters.setValue, (update: SetMeters) => {
            this.setState((oldState) => {
                const newGauges = [...oldState.gauges];
                for (const [id, value] of Object.entries(update.values)) {
                    const config = newGauges[id].config;
                    const scale = config.scale || 1;
                    newGauges[id] = {value: value / scale, config};
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
