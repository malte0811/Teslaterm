import React from "react";
import {CoilID} from "../../../common/constants";
import {getToRenderIPCPerCoil, MeterConfig, SetMeters} from "../../../common/IPCConstantsToRenderer";
import {TTComponent} from "../../TTComponent";
import {Gauge, GaugeProps} from "./Gauge";

export const NUM_GAUGES = 7;

export interface GaugesProps {
    darkMode: boolean;
    coil: CoilID;
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
        const coilChannels = getToRenderIPCPerCoil(this.props.coil);
        this.addIPCListener(coilChannels.meters.configure, (config: MeterConfig) => {
            this.setState((oldState) => {
                const newGauges: GaugeProps[] = [...oldState.gauges];
                newGauges[config.meterId] = {
                    config,
                    darkMode: this.props.darkMode,
                    value: newGauges[config.meterId].value,
                };
                return {gauges: newGauges};
            });
        });
        this.addIPCListener(coilChannels.meters.setValue, (update: SetMeters) => {
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

    public render(): React.ReactNode {
        return <div className={'tt-gauges'}>
            {this.state.gauges.map((p, i) => <Gauge {...p} key={i}/>)}
        </div>;
    }
}
