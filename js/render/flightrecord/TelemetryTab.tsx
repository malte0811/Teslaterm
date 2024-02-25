import React from "react";
import {TelemetryEvent} from "../../common/constants";
import {FRDisplayEventType} from "../../common/FlightRecorderTypes";
import {MeterConfig} from "../../common/IPCConstantsToRenderer";
import {FRDisplayData} from "../connect/ConnectScreen";
import {Gauge, GaugeProps} from "../control/gauges/Gauge";
import {ScopeSettings} from "../control/scope/ScopeSettings";
import {ScopeStatistics} from "../control/scope/ScopeStatistics";
import {OscilloscopeTrace, TraceConfig, TraceStats} from "../control/scope/Trace";
import {Traces} from "../control/scope/Traces";
import {SimpleSliderFixedTitle} from "../control/sliders/SimpleSlider";
import {TTComponent} from "../TTComponent";

export interface TelemetryTabProps {
    darkMode: boolean;
    events: FRDisplayData;
}

interface TelemetryState {
    gauges: GaugeProps[];
    time: number;
    chartStateIndex: number;
}

interface ChartState {
    currentValue: number;
    firstIndexOfLine: number;
    config: TraceConfig;
}

export interface TelemetryTabState {
    lastIndexToShow: number;
    telemetryStates: TelemetryState[];
    chartStates: ChartState[][];
}

export class TelemetryTab extends TTComponent<TelemetryTabProps, TelemetryTabState> {
    public constructor(props) {
        super(props);
        const states: TelemetryState[] = [
            {
                chartStateIndex: -1,
                gauges: this.props.events.initial.meterConfigs.map(config => this.makeMeter(config)),
                time: -Infinity,
            },
        ];
        const chartStates: ChartState[][] = [
            this.props.events.initial.traceConfigs.map(cfg => ({
                config: new TraceConfig(cfg),
                currentValue: 0,
                firstIndexOfLine: 0,
            })),
        ];
        let nextChartStates: ChartState[] = [...chartStates[0]];
        const minTimeDelt = 0.1;
        const eventList = this.props.events.events;
        const endTime = eventList[eventList.length - 1].time;
        for (const event of eventList) {
            if (event.type !== FRDisplayEventType.telemetry) {
                continue;
            }
            const frame = event.frame;
            const oldState = states[states.length - 1];
            const oldGaugeProps = oldState.gauges;
            let newGaugeProps: GaugeProps[];
            switch (frame.type) {
                case TelemetryEvent.GAUGE:
                case TelemetryEvent.GAUGE32:
                    newGaugeProps = [...oldGaugeProps];
                    const oldProps = oldGaugeProps[frame.index];
                    if (oldProps) {
                        newGaugeProps[frame.index] = {...oldProps, value: frame.value / oldProps.config.scale};
                    }
                    break;
                case TelemetryEvent.GAUGE32_CONF:
                case TelemetryEvent.GAUGE_CONF:
                    newGaugeProps = [...oldGaugeProps];
                    newGaugeProps[frame.meterId] = this.makeMeter(frame);
                    break;
                case TelemetryEvent.CHART_CONF:
                case TelemetryEvent.CHART32_CONF:
                    nextChartStates[frame.config.id] = {
                        config: new TraceConfig(frame.config),
                        currentValue: 0,
                        firstIndexOfLine: chartStates.length,
                    };
                    break;
                case TelemetryEvent.CHART:
                case TelemetryEvent.CHART32:
                    if (nextChartStates[frame.index]) {
                        nextChartStates[frame.index] = {...nextChartStates[frame.index], currentValue: frame.value};
                    }
                    break;
                case TelemetryEvent.CHART_DRAW:
                    chartStates.push(nextChartStates);
                    nextChartStates = [...nextChartStates];
                    break;
            }
            if (newGaugeProps) {
                const now = (event.time - endTime) / 1e6;
                if (now - oldState.time > minTimeDelt) {
                    states.push({
                        chartStateIndex: chartStates.length - 1,
                        gauges: newGaugeProps,
                        time: now,
                    });
                } else {
                    states[states.length - 1].gauges = newGaugeProps;
                }
            }
        }
        states.shift();
        if (chartStates.length > 1) {
            chartStates[0] = chartStates[1];
        }
        this.state = {
            chartStates,
            lastIndexToShow: 0,
            telemetryStates: states,
        };
    }

    public render() {
        const state = this.state.telemetryStates[this.state.lastIndexToShow];
        const traces = this.state.chartStates[state.chartStateIndex].map(
            (_, i) => this.makeTraceAt(state.chartStateIndex, i),
        );
        return (
            <div className='tt-fr-telemetry'>
                <div className='tt-fr-telemetry-control'>
                    <SimpleSliderFixedTitle
                        title={`Showing at ${state.time.toFixed(3)} seconds`}
                        min={0}
                        max={this.state.telemetryStates.length - 1}
                        value={this.state.lastIndexToShow}
                        setValue={(value) => this.setState({lastIndexToShow: value})}
                        visuallyEnabled={true}
                        disabled={false}
                    />
                </div>
                <div className='tt-fr-telemetry-display'>
                    <div className={'tt-fr-scope'}>
                        <div className={'tt-scope-middle-row'}>
                            <Traces traces={traces}/>
                            <ScopeSettings configs={traces.map((t) => t.config)}/>
                        </div>
                        <ScopeStatistics
                            traces={traces}
                            clearStats={() => {}}
                        />
                    </div>
                    <div className={'tt-gauges'}>
                        {state.gauges.map((p, i) => <Gauge {...p} key={i}/>)}
                    </div>
                </div>
            </div>
        );
    }

    private makeMeter(config: MeterConfig): GaugeProps {
        return {
            config,
            darkMode: this.props.darkMode,
            value: config.min,
        };
    }

    private makeTraceAt(traceStateId: number, traceId: number) {
        const lastData = this.state.chartStates[traceStateId][traceId];
        let stats = new TraceStats();
        const samples: number[] = [];
        // TODO there's another magic constant for this somewhere
        const startIndex = Math.max(lastData.firstIndexOfLine, traceStateId - 1e4);
        for (let i = startIndex; i <= traceStateId; ++i) {
            // TODO apply divider elsewhere
            const value = this.state.chartStates[i][traceId].currentValue / lastData.config.divider;
            samples.push(value);
            stats = stats.withValue(value);
        }
        if (lastData.config === undefined) {
            console.error(lastData, traceStateId, traceId);
            throw new Error('undef divider');
        }
        return new OscilloscopeTrace(lastData.config, samples, stats);
    }
}
