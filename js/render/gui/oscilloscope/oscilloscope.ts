import {MediaFileType, PlayerActivity} from "../../../common/CommonTypes";
import {MediaState} from "../../../common/IPCConstantsToRenderer";
import {CONTROL_SPACE, INFO_SPACE, MEAS_SPACE, TOP_SPACE, TRIGGER_SPACE} from "../constants";
import {NUM_GAUGES} from "../gauges";
import {Trace} from "./trace";

let waveCanvas: HTMLCanvasElement;
let backCanvas: HTMLCanvasElement;
let waveContext: CanvasRenderingContext2D;
let backContext: CanvasRenderingContext2D;

export let traces: Trace[] = [];
let xPos: number = TRIGGER_SPACE + 1;
let pixelRatio: number = 1;

enum DrawMode {
    standard = 0,
    controlled = 1,
}

let drawMode: DrawMode = DrawMode.standard;

const gridResolution = 50;
const wavecolors: string[] = ["white", "red", "blue", "green", "rgb(255, 128, 0)", "rgb(128, 128, 64)", "rgb(128, 64, 128)", "rgb(64, 128, 128)", "DimGray"];

export function plotTraces(): void {

    const x_res = waveCanvas.width - INFO_SPACE;
    const y_res = waveCanvas.height - MEAS_SPACE - TOP_SPACE;

    waveContext.clearRect(xPos, TOP_SPACE, pixelRatio, y_res);

    for (const trace of traces) {
        trace.plot(waveCanvas, waveContext, xPos);
    }

    xPos += pixelRatio;
    if (xPos >= x_res) {
        redrawMeas();
        xPos = TRIGGER_SPACE + 1;
    }
    drawMode = DrawMode.standard;
}

// TODO also redraw gauge labels on resize!
export function onResize(): void {
    xPos = TRIGGER_SPACE + 1;
    waveCanvas.style.width = (90 - CONTROL_SPACE) + "%";
    waveCanvas.style.height = "100%";
    waveCanvas.width = waveCanvas.offsetWidth;
    waveCanvas.height = waveCanvas.offsetHeight;
    backCanvas.style.width = (90 - CONTROL_SPACE) + "%";
    backCanvas.style.height = "100%";
    backCanvas.width = waveCanvas.offsetWidth;
    backCanvas.height = waveCanvas.offsetHeight;
    // HiDPI display support
    if (window.devicePixelRatio) {
        pixelRatio = window.devicePixelRatio;
        const height: number = Number(waveCanvas.getAttribute("height"));
        const width: number = Number(waveCanvas.getAttribute("width"));
        // reset the canvas width and height with window.devicePixelRatio applied
        waveCanvas.setAttribute("width", Math.round(width * window.devicePixelRatio).toString());
        waveCanvas.setAttribute("height", Math.round(height * window.devicePixelRatio).toString());
        backCanvas.setAttribute("width", Math.round(width * window.devicePixelRatio).toString());
        backCanvas.setAttribute("height", Math.round(height * window.devicePixelRatio).toString());
        // force the canvas back to the original size using css
        waveCanvas.style.width = width + "px";
        waveCanvas.style.height = height + "px";
        backCanvas.style.width = width + "px";
        backCanvas.style.height = height + "px";
    }
    if (drawMode === DrawMode.standard) {
        draw_grid();
        redrawInfo();
    }
}

export function init(): void {
    waveCanvas = (document.getElementById("waveCanvas") as HTMLCanvasElement);
    backCanvas = (document.getElementById("backCanvas") as HTMLCanvasElement);
    waveContext = waveCanvas.getContext("2d");
    backContext = backCanvas.getContext("2d");

    for (let i = 0; i < NUM_GAUGES; i++) {
        traces.push(new Trace(wavecolors[i]));
    }
}

export function draw_grid() {
    const x_res = waveCanvas.width - INFO_SPACE;
    const y_res = waveCanvas.height - MEAS_SPACE - TOP_SPACE;

    backContext.beginPath();
    backContext.strokeStyle = "yellow";
    backContext.lineWidth = pixelRatio;

    backContext.moveTo(TRIGGER_SPACE, Math.floor(y_res / 2) + TOP_SPACE);
    backContext.lineTo(x_res, Math.floor(y_res / 2) + TOP_SPACE);

    backContext.stroke();

    backContext.beginPath();
    backContext.lineWidth = pixelRatio;
    backContext.strokeStyle = "yellow";
    backContext.moveTo(TRIGGER_SPACE + 1, TOP_SPACE);
    backContext.lineTo(TRIGGER_SPACE + 1, y_res + TOP_SPACE);
    backContext.stroke();
    backContext.beginPath();
    backContext.lineWidth = pixelRatio;
    backContext.strokeStyle = "grey";
    for (let i: number = TRIGGER_SPACE + gridResolution; i < x_res; i = i + gridResolution) {
        backContext.moveTo(i, TOP_SPACE);
        backContext.lineTo(i, y_res + TOP_SPACE);
    }

    for (let i: number = (y_res / 2) + (y_res / 10); i < y_res; i = i + (y_res / 10)) {
        backContext.moveTo(TRIGGER_SPACE, i + TOP_SPACE);
        backContext.lineTo(x_res, i + TOP_SPACE);
        backContext.moveTo(TRIGGER_SPACE, y_res - i + TOP_SPACE);
        backContext.lineTo(x_res, y_res - i + TOP_SPACE);
    }

    backContext.stroke();
}

const ud3_assumed_width = 450;
const ud3_assumed_height = 350;

function transform_point(x: number, y: number): [number, number] {
    return [
        x * waveCanvas.width / ud3_assumed_width,
        y * waveCanvas.height / ud3_assumed_height,
    ];
}

function transform_text_size(old_size: number): number {
    const scale = Math.min(
        waveCanvas.width / ud3_assumed_width,
        waveCanvas.height / ud3_assumed_height,
    );
    if (scale > 1) {
        return old_size * scale;
    } else {
        return old_size;
    }
}

function checkControlled() {
    if (drawMode !== DrawMode.controlled) {
        beginControlledDraw();
    }
}

export function drawLine(x1: number, y1: number, x2: number, y2: number, color: number) {
    checkControlled();
    waveContext.beginPath();
    waveContext.lineWidth = pixelRatio;
    waveContext.strokeStyle = wavecolors[color];
    waveContext.moveTo(...transform_point(x1, y1));
    waveContext.lineTo(...transform_point(x2, y2));
    waveContext.stroke();
}

export function clear() {
    backContext.clearRect(0, 0, backCanvas.width, backCanvas.height);
    waveContext.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
    xPos = TRIGGER_SPACE + 1;
}

export function beginControlledDraw() {
    clear();
    drawMode = DrawMode.controlled;
}

function beginStandardDraw() {
    clear();
    draw_grid();
    redrawMeas();
    redrawInfo();

    drawMode = DrawMode.standard;
}

export function drawString(x: number, y: number, color: number, size: number, str: string, center: boolean) {
    checkControlled();
    waveContext.font = transform_text_size(size) + "px Arial";
    waveContext.textAlign = "left";
    waveContext.fillStyle = wavecolors[color];
    if (center) {
        waveContext.fillText(str, ...transform_point(x, y));
    } else {
        waveContext.fillText(str, ...transform_point(x, y));
    }
}

export function drawChart(): void {
    if (drawMode !== DrawMode.standard) {
        beginStandardDraw();
    }
    plotTraces();
    redrawMeas();
}

export function redrawInfo() {
    const x_res = waveCanvas.width;
    const y_res = waveCanvas.height;
    waveContext.clearRect(x_res - INFO_SPACE, 0, x_res, y_res - MEAS_SPACE);
    waveContext.font = "12px Arial";
    waveContext.textAlign = "left";
    const tterm_length = traces.length;
    for (let i = 0; i < tterm_length; i++) {
        traces[i].drawInfo(waveContext, i);
    }
}

function redrawMeas() {
    const x_res = waveCanvas.width;
    const y_res = waveCanvas.height;
    waveContext.clearRect(TRIGGER_SPACE, y_res - MEAS_SPACE, x_res - TRIGGER_SPACE, y_res);
    let text_pos = TRIGGER_SPACE;
    for (const trace of traces) {
        text_pos = trace.drawMeasurement(waveContext, text_pos);
    }
}

export function redrawMediaInfo(media_state: MediaState) {
    const x_res = waveCanvas.width;
    waveContext.clearRect(TRIGGER_SPACE, 0, x_res - INFO_SPACE, TOP_SPACE);

    waveContext.font = "12px Arial";
    waveContext.textAlign = "left";
    waveContext.fillStyle = "white";

    if (media_state.type !== MediaFileType.none) {
        let output: string = "MIDI";
        if (media_state.type === MediaFileType.sid_dmp) {
            output = "SID-DMP";
        } else if (media_state.type === MediaFileType.sid_emulated) {
            output = "SID";
        }
        output += "-File: " + media_state.title + " State: ";
        if (media_state.state === PlayerActivity.playing) {
            // TODO support for undefined length (real SID)?
            output += "playing " + media_state.progress + "% / 100%";
        } else {
            output += "idle";
        }
        waveContext.fillText(output, TRIGGER_SPACE, 12);
    }
}
