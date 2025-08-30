import React, {CSSProperties, KeyboardEventHandler, MouseEventHandler, useRef, useState} from "react";
import {Button} from "react-bootstrap";
import {ControlPosition} from "react-draggable";
import {TransformComponent, TransformWrapper} from "react-zoom-pan-pinch";
import {VMSBlockProps} from "./Block";
import {ArrowProps, BlockConnections, ScaleAndOffset, screenToLogicCoords} from "./BlockConnections";
import {DraggableBlock} from "./DraggableBlock";

export interface EditorCanvasProps {
    arrows: ArrowProps[];
    startPos?: ControlPosition;
    blocks: VMSBlockProps[];
    onAuxClick?: MouseEventHandler;
    onKeyPress: KeyboardEventHandler;
    addBlock: (position: ControlPosition) => void;
}

export function BlockEditorCanvas(props: EditorCanvasProps) {
    const mouseOwnerRef = useRef<HTMLDivElement>();
    const [draggingElement, setDraggingElement] = useState(false);
    const [transform, setTransform] = useState<ScaleAndOffset>({position: {x: 0, y: 0}, scale: 1});
    const mainRef = useRef<HTMLDivElement>();
    // TODO hack
    const wrappedBlocks = props.blocks.map((block, i) => <DraggableBlock
        {...block}
        onClick={() => {
            block.onClick();
            mainRef.current.focus();
        }}
        setDragging={setDraggingElement}
        scale={transform.scale}
        key={i}
    />);
    const baseProps: CSSProperties = {height: '100%', width: '100%'};
    return <div style={{position: 'relative', ...baseProps}} tabIndex={0} onKeyDown={props.onKeyPress} ref={mainRef}>
        <div ref={mouseOwnerRef} style={{position: 'absolute', zIndex: 0, ...baseProps}}>
            <BlockConnections arrows={props.arrows} transform={transform} startPos={props.startPos}/>
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
        <Button
            style={{position: 'absolute', right: '1cm', bottom: '1cm', zIndex: 2}}
            onClick={() => {
                const mainDiv = mainRef.current;
                props.addBlock(screenToLogicCoords(
                    {x: mainDiv.clientWidth / 2, y: mainDiv.clientHeight / 2}, transform,
                ));
            }}
        >+</Button>
    </div>;
}
