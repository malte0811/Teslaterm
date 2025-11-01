import React, {useEffect, useState} from "react";
import {TelemetryEvent} from "../../common/constants";
import {FRDisplayEventType, InitialFRState, ParsedEvent} from "../../common/FlightRecorderTypes";
import {MeterConfig} from "../../common/IPCConstantsToRenderer";
import {Gauge, GaugeProps} from "../control/gauges/Gauge";
import {ScopeSettings} from "../control/scope/ScopeSettings";
import {ScopeStatistics} from "../control/scope/ScopeStatistics";
import {OscilloscopeTrace, TraceConfig, TraceStats} from "../control/scope/Trace";
import {Traces} from "../control/scope/Traces";
import {SimpleSliderFixedTitle} from "../control/sliders/SimpleSlider";
import {TTComponent} from "../TTComponent";

export interface TelemetryTabProps {
    events: ParsedEvent[];
    initial: InitialFRState;
    endTime: number;
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

function makeMeter(config: MeterConfig): GaugeProps {
    return {config, value: config.min};
}

function computeDisplayStates(
    initial: InitialFRState, events: ParsedEvent[], endTime: number
): [ChartState[][], TelemetryState[]] {
    const states: TelemetryState[] = [
        {
            chartStateIndex: 0,
            gauges: initial.meterConfigs.map(config => makeMeter(config)),
            time: -Infinity,
        },
    ];
    const chartStates: ChartState[][] = [
        initial.traceConfigs.map(cfg => ({
            config: new TraceConfig(cfg),
            currentValue: 0,
            firstIndexOfLine: 0,
        })),
    ];
    let nextChartStates: ChartState[] = [...chartStates[0]];
    const minTimeDelt = 0.1;
    const eventList = events;
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
                newGaugeProps[frame.meterId] = makeMeter(frame);
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
                    chartStateIndex: Math.max(chartStates.length - 1, 0),
                    gauges: newGaugeProps,
                    time: now,
                });
            } else {
                states[states.length - 1].gauges = newGaugeProps;
            }
        }
    }
    if (states.length > 1) {
        states.shift();
    }
    if (chartStates.length > 1) {
        chartStates[0] = chartStates[1];
    }
    return [chartStates, states];
}

export function TelemetryTab(props: TelemetryTabProps) {
    const [lastIndexToShow, setLastIndexToShow] = useState(0);
    const [telemetryStates, setTelemetryStates] = useState<TelemetryState[]>([{
        chartStateIndex: 0,
        gauges: [],
        time: 0,
    }]);
    const [chartStates, setChartStates] = useState<ChartState[][]>([[]]);
    useEffect(() => {
        const [newCharts, newTelemetry] = computeDisplayStates(props.initial, props.events, props.endTime);
        setChartStates(newCharts);
        setTelemetryStates(newTelemetry);
    }, [props.events, props.initial]);
    const state = telemetryStates[lastIndexToShow];
    const makeTraceAt = (traceStateId: number, traceId: number) => {
        const lastData = chartStates[traceStateId][traceId];
        let stats = new TraceStats();
        const samples: number[] = [];
        // TODO there's another magic constant for this somewhere
        const startIndex = Math.max(lastData.firstIndexOfLine, traceStateId - 1e4);
        for (let i = startIndex; i <= traceStateId; ++i) {
            // TODO apply divider elsewhere
            const value = chartStates[i][traceId].currentValue / lastData.config.divider;
            samples.push(value);
            stats = stats.withValue(value);
        }
        if (lastData.config === undefined) {
            console.error(lastData, traceStateId, traceId);
            throw new Error('undef divider');
        }
        return new OscilloscopeTrace(lastData.config, samples, stats);
    };
    const traces = chartStates[state.chartStateIndex].map(
        (_, i) => makeTraceAt(state.chartStateIndex, i),
    );
    return (
        <div className='tt-fr-telemetry'>
            <div className='tt-fr-telemetry-control'>
                <SimpleSliderFixedTitle
                    title={`Showing at ${state.time.toFixed(3)} seconds`}
                    min={0}
                    max={telemetryStates.length - 1}
                    value={lastIndexToShow}
                    setValue={(value) => setLastIndexToShow(value)}
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
                        clearStats={() => {
                        }}
                    />
                </div>
                <div className={'tt-gauges'}>
                    {state.gauges.map((p, i) => <Gauge {...p} key={i}/>)}
                </div>
            </div>
        </div>
    );
}
