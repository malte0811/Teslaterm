import React, {CSSProperties, MouseEventHandler, useRef, useState} from "react";
import {ControlPosition} from "react-draggable";
import {TransformComponent, TransformWrapper} from "react-zoom-pan-pinch";
import {VMSBlockProps} from "./Block";
import {ArrowProps, BlockConnections, ScaleAndOffset} from "./BlockConnections";
import {DraggableBlock} from "./DraggableBlock";

export interface EditorCanvasProps {
    arrows: ArrowProps[];
    blocks: VMSBlockProps[];
    onAuxClick?: MouseEventHandler;
}

export function VMSEditorCanvas(props: EditorCanvasProps) {
    const mouseOwnerRef = useRef<HTMLDivElement>();
    const [draggingElement, setDraggingElement] = useState(false);
    const [transform, setTransform] = useState<ScaleAndOffset>({position: {x: 0, y: 0}, scale: 1});
    const wrappedBlocks = props.blocks.map((block, i) => <DraggableBlock
        {...block} setDragging={setDraggingElement} scale={transform.scale} key={i}
    />);
    const baseProps: CSSProperties = {height: '100%', width: '100%'};
    return <div style={{position: 'relative', ...baseProps}}>
        <div ref={mouseOwnerRef} style={{position: 'absolute', zIndex: 0, ...baseProps}}>
            <BlockConnections arrows={props.arrows} transform={transform}/>
        </div>
        <div style={{position: 'relative', zIndex: 1, ...baseProps}} onAuxClick={props.onAuxClick}>
            <TransformWrapper
                disabled={draggingElement}
                limitToBounds={false}
                minScale={0.5}
                onTransformed={(_, data) => setTransform({
                    position: {x: data.positionX, y: data.positionY},
                    scale: data.scale,
                })}
            >
                <TransformComponent wrapperStyle={baseProps} contentStyle={baseProps}>
                    {wrappedBlocks}
                </TransformComponent>
            </TransformWrapper>
        </div>
    </div>;
}
