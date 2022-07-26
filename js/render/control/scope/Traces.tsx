import React from "react";
import {CanvasComponent} from "./CanvasComponent";
import {OscilloscopeTrace, NUM_VERTICAL_DIVS, TraceConfig} from "./Trace";

const PIXELS_PER_HORIZONTAL_DIV = 100;

export interface TraceProps {
    traces: OscilloscopeTrace[];
}

export class Traces extends CanvasComponent<TraceProps, {}> {
    protected draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
        Traces.drawGrid(ctx, width, height);
        for (const trace of this.props.traces) {
            Traces.drawTrace(trace.config, trace.data, ctx, width, height);
        }
    }

    private static drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'white';
        ctx.beginPath();
        for (let x = width - PIXELS_PER_HORIZONTAL_DIV; x > 0; x -= PIXELS_PER_HORIZONTAL_DIV) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }
        ctx.stroke();
        for (let div = 0; div <= NUM_VERTICAL_DIVS; ++div) {
            ctx.lineWidth = div === NUM_VERTICAL_DIVS ? 3 : 1;
            ctx.strokeStyle = div === NUM_VERTICAL_DIVS ? 'yellow' : 'white';
            ctx.beginPath();
            ctx.moveTo(0, height * div / NUM_VERTICAL_DIVS);
            ctx.lineTo(width, height * div / NUM_VERTICAL_DIVS);
            ctx.stroke();
        }

    }

    private static drawTrace(
        config: TraceConfig, data: number[], ctx: CanvasRenderingContext2D, width: number, height: number
    ) {
        ctx.strokeStyle = config.wavecolor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(width + 10, 0);
        const dataOffset = width - (data.length - 1);
        for (let x = width; x >= 0 && x >= dataOffset; --x) {
            const valueDivs = (data[x - dataOffset] - config.visualOffset) / config.perDiv;
            const valuePixels = valueDivs * height / NUM_VERTICAL_DIVS;
            // Canvas coords have 0 at the top, so we need to invert here
            const y = height - valuePixels;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
}
