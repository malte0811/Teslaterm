import React, {CSSProperties, MouseEventHandler, useRef, useState} from "react";
import {TransformComponent, TransformWrapper} from "react-zoom-pan-pinch";
import {VMSBlockProps} from "./Block";
import {ArrowProps, BlockConnections} from "./BlockConnections";
import {DraggableBlock} from "./DraggableBlock";

export interface EditorCanvasProps {
    arrows: ArrowProps[];
    blocks: VMSBlockProps[];
    onAuxClick?: MouseEventHandler;
}

export function VMSEditorCanvas(props: EditorCanvasProps) {
    const mouseOwnerRef = useRef<HTMLDivElement>();
    const [draggingElement, setDraggingElement] = useState(false);
    const [scale, setScale] = useState(1);
    const wrappedBlocks = props.blocks.map((block, i) => <DraggableBlock
        {...block} setDragging={setDraggingElement} scale={scale} key={i}
    />);
    const baseProps: CSSProperties = {height: '100%', width: '100%'};
    return <TransformWrapper
        disabled={draggingElement}
        // TODO set initial bounds to cover all blocks
        onTransformed={(_, data) => setScale(data.scale)}
    >
        <TransformComponent
            wrapperStyle={{position: 'relative', ...baseProps}}
            contentStyle={baseProps}
        >
            <div style={{position: 'absolute', zIndex: 0, ...baseProps}}>
                <BlockConnections arrows={props.arrows} scale={scale}/>
            </div>
            <div
                style={{position: 'relative', zIndex: 1, ...baseProps}}
                ref={mouseOwnerRef}
                onAuxClick={props.onAuxClick}
            >
                {wrappedBlocks}
            </div>
        </TransformComponent>
    </TransformWrapper>;
}
