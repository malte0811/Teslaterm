import React from 'react';
import {ScopeLine, ScopeText} from '../../../common/IPCConstantsToRenderer';
import {CanvasComponent} from './CanvasComponent';
import {TRACE_COLORS} from './Oscilloscope';

export type DrawCommand = {type: 'line', data: ScopeLine} | {type: 'text', data: ScopeText};

export interface ControlledDrawProps {
    commandList: DrawCommand[];
    title: string;
}

const UD3_ASSUMED_WIDTH = 450;
const UD3_ASSUMED_HEIGHT = 350;

export class ControlledDraw extends CanvasComponent<ControlledDrawProps, {}> {
    protected draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
        for (const command of this.props.commandList) {
            if (command.type === 'line') {
                const data = command.data;
                // TODO why did 1 work well on the old version but looks really thin now?
                ctx.lineWidth = 2;
                ctx.strokeStyle = TRACE_COLORS[data.traceColorIndex];
                ctx.beginPath();
                ctx.moveTo(ControlledDraw.transformX(data.x1, width), ControlledDraw.transformY(data.y1, height));
                ctx.lineTo(ControlledDraw.transformX(data.x2, width), ControlledDraw.transformY(data.y2, height));
                ctx.stroke();
            } else {
                const data = command.data;
                ctx.font = ControlledDraw.transformTextSize(data.size, width, height) + 'px Arial';
                ctx.textAlign = data.center ? 'center' : 'left';
                ctx.fillStyle = TRACE_COLORS[data.traceColorIndex];
                ctx.beginPath();
                ctx.fillText(
                    data.str, ControlledDraw.transformX(data.x, width), ControlledDraw.transformY(data.y, height)
                );
                ctx.stroke();
            }
        }
    }

    private static transformX(ud3x: number, width: number) {
        return ud3x * width / UD3_ASSUMED_WIDTH;
    }

    private static transformY(ud3y: number, height: number) {
        return ud3y * height / UD3_ASSUMED_HEIGHT;
    }

    private static transformTextSize(ud3size: number, width: number, height: number): number {
        const scale = Math.max(
            Math.min(width / UD3_ASSUMED_WIDTH, height / UD3_ASSUMED_HEIGHT), 1
        );
        return ud3size * scale;
    }
}
