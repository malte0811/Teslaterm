import {ScopeTraceConfig} from "../../../common/IPCConstantsToRenderer";
import {TRACE_COLORS} from "./Oscilloscope";

export const MAX_HORIZONTAL_NUM_SAMPLES = 10000;
export const NUM_VERTICAL_DIVS = 10;

export class TraceConfig {
    public readonly wavecolor: string;
    public readonly name: string;
    public readonly unit: string;
    public readonly perDiv: number;
    public readonly visualOffset: number;
    public readonly divider: number;

    // TODO just use STC?
    public constructor(cfg: ScopeTraceConfig) {
        const perDiv = (cfg.max - cfg.min) / NUM_VERTICAL_DIVS;
        this.wavecolor = TRACE_COLORS[cfg.id];
        this.name = cfg.name;
        this.unit = cfg.unit;
        this.perDiv = perDiv;
        this.visualOffset = cfg.offset;
        this.divider = cfg.div;
    }
}

export class TraceStats {
    public readonly min: number;
    public readonly max: number;
    private readonly squareSum: number;
    private readonly samples: number;

    constructor(
        min: number = Number.POSITIVE_INFINITY,
        max: number = Number.NEGATIVE_INFINITY,
        squareSum: number = 0,
        samples: number = 0,
    ) {
        this.min = min;
        this.max = max;
        this.squareSum = squareSum;
        this.samples = samples;
    }

    public get rms() {
        return Math.sqrt(this.squareSum / this.samples);
    }

    public withValue(newValue: number): TraceStats {
        return new TraceStats(
            Math.min(this.min, newValue),
            Math.max(this.max, newValue),
            this.squareSum + newValue * newValue,
            this.samples + 1,
        );
    }
}

export class OscilloscopeTrace {
    public readonly config: TraceConfig;
    public readonly data: number[];
    public readonly stats: TraceStats;

    constructor(config: TraceConfig, data: number[] = [], stats: TraceStats = new TraceStats()) {
        this.config = config;
        this.data = data;
        this.stats = stats;
    }

    public duplicateLast(): OscilloscopeTrace {
        if (this.data.length > 0) {
            return this.withScaledValue(this.data[this.data.length - 1]);
        } else {
            return this;
        }
    }

    public withSample(ud3value: number): OscilloscopeTrace {
        return this.withScaledValue(ud3value / this.config.divider);
    }

    public withCfg(newCfg: TraceConfig): OscilloscopeTrace {
        if (newCfg.name !== this.config.name || newCfg.unit !== this.config.unit) {
            return new OscilloscopeTrace(newCfg);
        } else {
            return new OscilloscopeTrace(newCfg, this.data, this.stats);
        }
    }

    public withClearedStats(): OscilloscopeTrace {
        return new OscilloscopeTrace(this.config, this.data);
    }

    private withScaledValue(value: number): OscilloscopeTrace {
        const newData = [...this.data];
        newData.push(value);
        if (newData.length > MAX_HORIZONTAL_NUM_SAMPLES) {
            newData.shift();
        }
        const newStats = this.stats.withValue(value);
        return new OscilloscopeTrace(this.config, newData, newStats);
    }
}
