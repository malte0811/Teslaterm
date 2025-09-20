import {NewCanvasComponent} from "./CanvasComponent";
import {NUM_VERTICAL_DIVS, OscilloscopeTrace, TraceConfig} from "./Trace";

const PIXELS_PER_HORIZONTAL_DIV = 100;

export interface TraceProps {
    traces: OscilloscopeTrace[];
}

export type Interval = [number, number];

export function interpolate(position: number, interval: Interval) {
    return interval[0] + position * (interval[1] - interval[0]);
}

export function uniformGrid(size: number, interval: Interval = [0, 1]) {
    const result = new Array(Math.floor(size)).fill(0).map((_, i) => interpolate(i / size, interval));
    result.push(interpolate(1, interval));
    return result;
}

export function drawGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    verticalLines: number[],
    horizontalLines: number[],
    rightIsCritical: boolean,
) {
    const yMin = horizontalLines[0] * height;
    const yMax = horizontalLines[horizontalLines.length - 1] * height;
    const setStyle = (highlight: boolean) => {
        ctx.lineWidth = highlight ? 3 : 1;
        ctx.strokeStyle = highlight ? 'yellow' : 'white';
    };
    verticalLines.forEach((x, i) => {
        const highlight = i === (rightIsCritical ? verticalLines.length - 1 : 0);
        setStyle(highlight);
        ctx.beginPath();
        ctx.moveTo(x * width, yMin);
        ctx.lineTo(x * width, yMax);
        ctx.stroke();
    });
    const xMin = verticalLines[0] * width;
    const xMax = verticalLines[verticalLines.length - 1] * width;
    const drawHorizontal = (y: number, highlight: boolean) => {
        setStyle(highlight);
        ctx.beginPath();
        ctx.moveTo(xMin, height * y);
        ctx.lineTo(xMax, height * y);
        ctx.stroke();
    };
    horizontalLines.forEach((y, i) => drawHorizontal(y, i === horizontalLines.length - 1));
}

function drawTrace(
    config: TraceConfig, data: number[], ctx: CanvasRenderingContext2D, width: number, height: number,
) {
    ctx.strokeStyle = config.wavecolor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const dataOffset = width - (data.length - 1);
    for (let x = width; x >= 0 && x >= dataOffset; --x) {
        const valueDivs = (data[x - dataOffset] - config.visualOffset) / config.perDiv;
        const valuePixels = valueDivs * height / NUM_VERTICAL_DIVS;
        // Canvas coords have 0 at the top, so we need to invert here
        const y = height - valuePixels;
        if (x === width) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
}

export function Traces(props: TraceProps) {
    return <NewCanvasComponent
        render={(ctx, width, height) => {
            const horizontalLines = uniformGrid(NUM_VERTICAL_DIVS);
            const verticalLines: number[] = [0];
            for (let x = width - PIXELS_PER_HORIZONTAL_DIV; x > 0; x -= PIXELS_PER_HORIZONTAL_DIV) {
                verticalLines.push(x / width);
            }
            verticalLines.push(1);
            verticalLines.sort();
            drawGrid(ctx, width, height, verticalLines, horizontalLines, true);
            for (const trace of props.traces) {
                drawTrace(trace.config, trace.data, ctx, width, height);
            }
        }}
        renderDeps={[props]}
    />;
}
