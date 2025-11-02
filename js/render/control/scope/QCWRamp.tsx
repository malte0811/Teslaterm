import {QCW_STEPS_PER_MS} from "../qcw/SimpleQCWPulse";
import {CanvasComponent} from "./CanvasComponent";
import {drawGrid, interpolate, Interval, uniformGrid} from "./Traces";

export interface QCWRampProps {
    points: number[];
}

const Y_GRID_SIZE = 8;
const BOTTOM_SPACE = 30;
const TOP_SPACE = 15;
const LEFT_SPACE = 40;
const RIGHT_SPACE = 5;
const TEXT_SIZE = 15;
const Y_SIZE = 256;

export function QCWRamp(props: QCWRampProps) {
    return <CanvasComponent render={(ctx, width, height) => {
        const relativeYInterval: Interval = [TOP_SPACE / height, 1 - BOTTOM_SPACE / height];
        const horizontalLines = uniformGrid(Y_GRID_SIZE, relativeYInterval);
        const xSize = props.points.length;
        let numVerticalLines = xSize / QCW_STEPS_PER_MS;
        while (width / numVerticalLines < 100) {
            numVerticalLines /= 2;
        }
        const relativeXInterval: Interval = [LEFT_SPACE / width, 1 - RIGHT_SPACE / height];
        const verticalLines = uniformGrid(numVerticalLines, relativeXInterval);
        drawGrid(ctx, width, height, verticalLines, horizontalLines, false);
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = TEXT_SIZE + 'px Arial';
        for (let i = 0; i < horizontalLines.length; ++i) {
            const value = Y_SIZE * (1 - i / Y_GRID_SIZE);
            ctx.fillText(value.toFixed(0), LEFT_SPACE / 2, horizontalLines[i] * height + TEXT_SIZE / 2);
        }
        const verticalValues = uniformGrid(numVerticalLines);
        for (let i = 0; i < verticalLines.length; ++i) {
            const value = xSize / QCW_STEPS_PER_MS * verticalValues[i];
            ctx.fillText(value.toFixed(0), verticalLines[i] * width, height - (BOTTOM_SPACE - TEXT_SIZE) / 2);
        }

        ctx.strokeStyle = 'red';
        ctx.lineWidth = 1;
        ctx.beginPath();
        props.points.forEach((value, i) => {
            const x = interpolate(i / xSize, relativeXInterval);
            const xNext = interpolate((i + 1) / xSize, relativeXInterval);
            const y = interpolate(1 - value / Y_SIZE, relativeYInterval);
            ctx.moveTo(x * width, y * height);
            ctx.lineTo(xNext * width, y * height);
        });
        ctx.stroke();
    }} renderDeps={[props]}/>;
}
