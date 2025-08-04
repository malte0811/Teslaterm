import React, {CSSProperties, MouseEventHandler, RefObject, useEffect, useRef, useState} from "react";
import {ControlPosition} from "react-draggable";
import {TransformComponent, TransformWrapper} from "react-zoom-pan-pinch";
import {Block, BlockIO} from "../../common/VMS";
import {VMSBlockProps} from "./Block";
import {ArrowProps, BlockConnections} from "./BlockConnections";
import {DraggableBlock} from "./DraggableBlock";
import {getPosition} from "./VMSBlockOffsets";
import {findBlock} from "./VMSEditor";

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
        // TODO somehow make sure that the "bounds" are the same for all screen/window sizes
        limitToBounds={true}
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
