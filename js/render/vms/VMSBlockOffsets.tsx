import React, {CSSProperties} from "react";
import {ControlPosition} from "react-draggable";
import {Block, BlockIO, OUTPUTS} from "../../common/vms/VMS";

export const BLOCK_WIDTH = 100;
export const BLOCK_HEIGHT = 150;
export const BLOCK_IO_SIZE = 0.1 * BLOCK_WIDTH;
export const INPUT_CENTER_X_OFFSET = 0.5 * BLOCK_WIDTH;
export const OFFOUT_CENTER_Y_OFFSET = 0.5 * BLOCK_HEIGHT;
export const MODULATION_WIDTH = 0.75 * BLOCK_WIDTH;
export const MODULATION_HEIGHT = 0.4 * BLOCK_HEIGHT;

export const BLOCK_STYLE: CSSProperties = {
    height: BLOCK_HEIGHT,
    width: BLOCK_WIDTH,
};
const IO_BASE_CSS: CSSProperties = {
    height: BLOCK_IO_SIZE,
    width: BLOCK_IO_SIZE,
};

export function numShownOutputs(block: Block) {
    return Math.min(block.outputBlocks.length + 1, OUTPUTS);
}

export function outputCenterXOffset(block: Block, outputId: number) {
    return (outputId + 1) / (numShownOutputs(block) + 1) * BLOCK_WIDTH;
}

export function getPosition(block: Block, io: BlockIO): ControlPosition {
    if (io === 'off') {
        return {x: block.visualX, y: block.visualY + OFFOUT_CENTER_Y_OFFSET};
    } else if (io === 'in') {
        return {x: block.visualX + INPUT_CENTER_X_OFFSET, y: block.visualY};
    } else {
        return {x: block.visualX + outputCenterXOffset(block, io), y: block.visualY + BLOCK_HEIGHT};
    }
}

interface BlockIOProps {
    onClick: (io: BlockIO) => void;
}

export function BlockOutputs(props: {block: Block, onClick: (output: number) => void}) {
    const outputs: React.JSX.Element[] = [];
    for (let i = 0; i < numShownOutputs(props.block); ++i) {
        outputs.push(<div
            style={{left: outputCenterXOffset(props.block, i) - BLOCK_IO_SIZE / 2, ...IO_BASE_CSS}}
            onClick={() => props.onClick(i)}
            onMouseDown={(ev) => ev.stopPropagation()}
            className={'vms-editor-block-output'}
        />);
    }
    return <>{...outputs}</>;
}

export function BlockInput(props: BlockIOProps) {
    return <div
        style={{left: INPUT_CENTER_X_OFFSET - BLOCK_IO_SIZE / 2, ...IO_BASE_CSS}}
        onClick={() => props.onClick('in')}
        onMouseDown={(ev) => ev.stopPropagation()}
        className={'vms-editor-block-input'}
    />;
}

export function BlockOffout(props: BlockIOProps) {
    return <div
        style={{top: OFFOUT_CENTER_Y_OFFSET - BLOCK_IO_SIZE / 2, ...IO_BASE_CSS}}
        onClick={() => props.onClick('off')}
        onMouseDown={(ev) => ev.stopPropagation()}
        className={'vms-editor-block-off'}
    />;
}
