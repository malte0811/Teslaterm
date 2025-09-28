import {CSSProperties} from "react";
import {Block, BlockIO, ModulationType, vmsValueToString} from "../../common/VMS";
import {
    BLOCK_STYLE,
    BlockInput,
    BlockOffout,
    BlockOutputs, MODULATION_HEIGHT, MODULATION_WIDTH,
} from "./VMSBlockOffsets";

export interface VMSBlockProps {
    block: Block;
    onClick: () => void;
    onIOClick: (io: BlockIO) => void;
    updateBlock: (update: Partial<Block>) => void;
    selected: boolean;
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
                return `M ${paddingX} ${maxY} C ${4 * paddingX} ${maxY} ${maxX - paddingX} ${9 * paddingY} ${maxX} ${paddingY}`;
            case ModulationType.exp_inverse:
                return `M ${paddingX} ${maxY} C ${2 * paddingX} ${maxY - 8 * paddingY} ${maxX - 3 * paddingX} ${paddingY} ${maxX} ${paddingY}`;
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
    const extraStyle: CSSProperties = {
        height: MODULATION_HEIGHT,
        width: MODULATION_WIDTH,
    };
    return <svg className={'vms-block-modulation'} style={extraStyle}>
        <path d={pathSpec} stroke={'orange'} fill={'transparent'} strokeWidth={4}/>
    </svg>;
}

export function BlockComponent(props: VMSBlockProps) {
    // TODO move styles to CSS file, make a bit fancier
    // TODO to show:
    // - Target value
    // - Target factor
    // - Period
    const className = 'vms-editor-block' + (props.selected ? '-selected' : '');
    const targetFactorString = (() => {
        const targetFactor = props.block.targetFactor;
        if (targetFactor.type === 'constant') {
            return targetFactor.value.toFixed(2);
        } else {
            return vmsValueToString(targetFactor.value);
        }
    })();
    return <div className={className} style={BLOCK_STYLE} onClick={props.onClick}>
        <ModulationVisualizer type={props.block.modulation.type}/>
        <BlockOutputs block={props.block} onClick={props.onIOClick}/>
        <BlockInput onClick={props.onIOClick}/>
        <BlockOffout onClick={props.onIOClick}/>
        <div className={'vms-block-target'}>{vmsValueToString(props.block.target)}</div>
        <div className={'vms-block-factor'}>{targetFactorString}</div>
        <div className={'vms-block-period'}>{props.block.periodMS.toFixed(0)}ms</div>
    </div>;
}
