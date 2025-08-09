import {CSSProperties} from "react";
import {Block, BlockIO, ModulationType} from "../../common/VMS";
import {
    BLOCK_STYLE,
    BlockInput,
    BlockOffout,
    BlockOutputs, MODULATION_CENTER_X_OFFSET, MODULATION_CENTER_Y_OFFSET,
    MODULATION_HEIGHT,
    MODULATION_WIDTH,
} from "./VMSBlockOffsets";

export interface VMSBlockProps {
    block: Block;
    onClick: () => void;
    onIOClick: (io: BlockIO) => void;
    updateBlock: (update: Partial<Block>) => void;
}

function ModulationVisualizer({type}: {type: ModulationType}) {
    const paddingX = MODULATION_WIDTH / 10;
    const paddingY = MODULATION_HEIGHT / 10;
    const maxY = MODULATION_HEIGHT - paddingY;
    const maxX = MODULATION_WIDTH - paddingX;
    const centerX =  MODULATION_WIDTH / 2;
    const pathSpec = (() => {
        switch (type) {
            case ModulationType.step:
                return `M ${paddingX} ${maxY} L ${centerX} ${maxY} ${centerX} ${paddingY} ${maxX} ${paddingY}`;
            case ModulationType.exp:
                return `M ${paddingX} ${maxY} C ${2 * paddingX} ${maxY - 8 * paddingY} ${maxX - 3 * paddingX} ${paddingY} ${maxX} ${paddingY}`;
            case ModulationType.exp_inverse:
                // TODO fix!
                return `M  ${paddingX} ${maxY} C ${4 * paddingX} ${maxY} ${maxX - paddingX} ${9 * paddingY} ${maxX} ${paddingY}`;
            case ModulationType.linear:
                return `M ${paddingX} ${maxY} L ${maxX} ${paddingY}`;
            case ModulationType.sine: {
                const xOff = paddingX;
                const yOff = 3 * paddingY;
                const centerY = MODULATION_HEIGHT / 2;
                return `M ${paddingX} ${centerY} C ${paddingX + xOff} ${centerY - yOff} ` +
                    `${centerX - xOff} ${centerY - yOff} ${centerX} ${centerY} ` +
                    `S ${maxX - xOff} ${centerY + yOff} ${maxX} ${centerY}`;
            }
        }
    })();
    const style: CSSProperties = {
        // TODO
        background: 'white',
        height: MODULATION_HEIGHT,
        left: MODULATION_CENTER_X_OFFSET - MODULATION_WIDTH / 2,
        position: "absolute",
        top: MODULATION_CENTER_Y_OFFSET - MODULATION_HEIGHT / 2,
        width: MODULATION_WIDTH,
    };
    return <svg style={style}>
        <path d={pathSpec} stroke={'orange'} fill={'transparent'} strokeWidth={4}/>
    </svg>;
}

export function BlockComponent(props: VMSBlockProps) {
    // TODO move styles to CSS file, make a bit fancier
    // TODO to show:
    // - Window with waveform illustration
    // - Target value
    // - Target factor
    // - Period
    // - Something for the start box!
    return <div className={'vms-editor-block'} style={BLOCK_STYLE} onClick={props.onClick}>
        <ModulationVisualizer type={props.block.modulation.type}/>
        <BlockOutputs block={props.block} onClick={props.onIOClick}/>
        <BlockInput onClick={props.onIOClick}/>
        <BlockOffout onClick={props.onIOClick}/>
        <div style={{top: 0, right: 0}}>{props.block.uid}</div>
    </div>;
}
