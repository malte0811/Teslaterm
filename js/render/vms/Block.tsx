import { CSSProperties } from "react";
import { Block } from "../../common/VMS";

export interface VMSBlockProps {
    block: Block;
    updateBlock: (update: Partial<Block>) => void;
}

export function BlockComponent(/*props: VMSBlockProps*/) {
    // TODO move styles to CSS file, make a bit fancier
    const makeOutput = (outputId: number) => {
        const style: CSSProperties = {
            left: `${(outputId + 0.75) * 20}%`
        };
        const onClick = (ev: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
            console.log(`Clicked on ${outputId}`);
        };
        return <div
            style={style}
            onClick={onClick}
            onMouseDown={(ev) => ev.stopPropagation()}
            className={'vms-editor-block-output'}
        />;
    };
    // TODO to show:
    // - Window with waveform illustration
    // - Target value
    // - Target factor
    // - Period
    // - Input and note-off boxes
    // - Something for the start box!
    return <div className={'vms-editor-block'}>
        {makeOutput(0)}
        {makeOutput(1)}
        {makeOutput(2)}
        {makeOutput(3)}
        <div className={'vms-editor-block-input'}/>
        <div className={'vms-editor-block-off'}/>
    </div>
}
