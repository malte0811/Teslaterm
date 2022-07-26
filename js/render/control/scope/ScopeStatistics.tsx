import React, {CSSProperties} from "react";
import {TTComponent} from "../../TTComponent";
import {TraceStats, TraceConfig, OscilloscopeTrace} from "./Trace";

interface SingleStatProps {
    stat: TraceStats;
    config: TraceConfig;
}

class SingleTraceStats extends TTComponent<SingleStatProps, {}> {
    render(): React.ReactNode {
        const style: CSSProperties = {
            color: this.props.config.wavecolor,
        };
        return <span style={style} className={'tt-trace-stats'}>
            <span className={'tt-trace-stat'}>Min: {this.props.stat.min.toFixed(2)}</span>
            <span className={'tt-trace-stat'}>Max: {this.props.stat.max.toFixed(2)}</span>
            <span className={'tt-trace-stat'}>RMS: {this.props.stat.rms.toFixed(2)}</span>
        </span>;
    }
}

export interface StatisticsProps {
    traces: OscilloscopeTrace[];
}

export class ScopeStatistics extends TTComponent<StatisticsProps, {}> {
    render(): React.ReactNode {
        return <div className={'tt-scope-stats'}>
            {this.props.traces.map((t, i) => <SingleTraceStats stat={t.stats} config={t.config} key={i}/>)}
        </div>;
    }
}
