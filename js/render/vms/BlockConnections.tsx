import {ControlPosition} from "react-draggable";
import {BlockIO, BlockOutput} from "../../common/VMS";
import {BLOCK_HEIGHT, INPUT_CENTER_X_OFFSET, OFFOUT_CENTER_Y_OFFSET, outputCenterXOffset} from "./VMSBlockOffsets";

export interface ArrowProps {
    fromBlock: ControlPosition;
    fromOutput: BlockIO;
    toBlock: ControlPosition;
    toType: 'in' | 'none';
}

function Arrow({fromBlock, fromOutput, toBlock, toType}: ArrowProps) {
    const bigM = 100;
    const[fromOffset, fromCtrlX, fromCtrlY] = (() => {
        if (fromOutput === 'off') {
            return [{x: 0, y: OFFOUT_CENTER_Y_OFFSET}, -bigM, 0];
        } else if (fromOutput === 'in') {
            return [{x: INPUT_CENTER_X_OFFSET, y: 0}, 0, -bigM];
        } else {
            return [{x: outputCenterXOffset(fromOutput), y: BLOCK_HEIGHT}, 0, bigM];
        }
    })();
    const[toOffset, toCtrlX, toCtrlY] = (() => {
        if (toType === 'none') {
            // TODO ctrl?
            return [{x: 0, y: 0}, 0, 0];
        } else {
            return [{x: INPUT_CENTER_X_OFFSET, y: 0}, 0, -bigM];
        }
    })();
    const realFrom = {x: fromBlock.x + fromOffset.x, y: fromBlock.y + fromOffset.y};
    const realTo = {x: toBlock.x + toOffset.x, y: toBlock.y + toOffset.y};
    const pt = (point: ControlPosition, xOff: number = 0, yOff: number = 0) => `${point.x + xOff} ${point.y + yOff}`;
    const pathStart = `M ${pt(realFrom)}`;
    const pathToEnd = `C ${pt(realFrom, fromCtrlX, fromCtrlY)} ${pt(realTo, toCtrlX, toCtrlY)} ${pt(realTo)}`;
    return <path d={`${pathStart} ${pathToEnd}`} stroke={'black'} fill={'transparent'} strokeWidth={4}/>;
}

export function BlockConnections({arrows}: {arrows: ArrowProps[]}) {
    return <svg width="100%" height="100%">
        {arrows.map((props, i) => <Arrow {...props} key={i}/>)}
    </svg>;
}

