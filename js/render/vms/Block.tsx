import {ControlPosition} from "react-draggable";
import {Block, BlockIO} from "../../common/VMS";
import {BLOCK_STYLE, BlockInput, BlockOffout, BlockOutput} from "./VMSBlockOffsets";

export interface VMSBlockProps {
    block: Block;
    onClick: (io: BlockIO) => void;
    setPosition: (p: ControlPosition) => void;
    position: ControlPosition;
    //updateBlock: (update: Partial<Block>) => void;
}

export function BlockComponent(props: VMSBlockProps) {
    // TODO move styles to CSS file, make a bit fancier
    // TODO to show:
    // - Window with waveform illustration
    // - Target value
    // - Target factor
    // - Period
    // - Something for the start box!
    return <div className={'vms-editor-block'} style={BLOCK_STYLE}>
        <BlockOutput onClick={props.onClick} outputId={0}/>
        <BlockOutput onClick={props.onClick} outputId={1}/>
        <BlockOutput onClick={props.onClick} outputId={2}/>
        <BlockOutput onClick={props.onClick} outputId={3}/>
        <BlockInput onClick={props.onClick}/>
        <BlockOffout onClick={props.onClick}/>
        <div style={{top: 0, right: 0}}>{props.block.uid}</div>
    </div>;
}
