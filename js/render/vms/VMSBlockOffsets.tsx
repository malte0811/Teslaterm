import {CSSProperties} from "react";
import {BlockIO} from "../../common/VMS";

export const BLOCK_WIDTH = 100;
export const BLOCK_HEIGHT = 150;
export const BLOCK_IO_SIZE = 0.1 * BLOCK_WIDTH;
export const INPUT_CENTER_X_OFFSET = 0.5 * BLOCK_WIDTH;
export const OFFOUT_CENTER_Y_OFFSET = 0.5 * BLOCK_HEIGHT;
export const BLOCK_STYLE: CSSProperties = {
    height: BLOCK_HEIGHT,
    width: BLOCK_WIDTH,
};
const IO_BASE_CSS: CSSProperties = {
    height: BLOCK_IO_SIZE,
    width: BLOCK_IO_SIZE,
};

export function outputCenterXOffset(outputId: number) {
    return (outputId + 1) * 0.2 * BLOCK_WIDTH;
}

interface BlockIOProps {
    onClick: (io: BlockIO) => void;
}

interface BlockOutputProps extends BlockIOProps {
    outputId: number;
}

export function BlockOutput(props: BlockOutputProps) {
    return <div
        style={{left: outputCenterXOffset(props.outputId) - BLOCK_IO_SIZE / 2, ...IO_BASE_CSS}}
        onClick={() => props.onClick(props.outputId)}
        onMouseDown={(ev) => ev.stopPropagation()}
        className={'vms-editor-block-output'}
    />;
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
