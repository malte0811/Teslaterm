import { Block } from "../../common/VMS";
import {BLOCK_STYLE, BlockInput, BlockOffout, BlockOutput} from "./VMSBlockOffsets";

export interface VMSBlockProps {
    block: Block;
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
        <BlockOutput onClick={() => {}} outputId={0}/>
        <BlockOutput onClick={() => {}} outputId={1}/>
        <BlockOutput onClick={() => {}} outputId={2}/>
        <BlockOutput onClick={() => {}} outputId={3}/>
        <BlockInput onClick={() => {}}/>
        <BlockOffout onClick={() => {}}/>
        <div style={{top: 0, right: 0}}>{props.block.uid}</div>
    </div>;
}
