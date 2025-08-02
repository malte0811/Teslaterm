import React, {MouseEventHandler, RefObject, useEffect, useRef, useState} from "react";
import {ControlPosition} from "react-draggable";
import {TransformComponent, TransformWrapper} from "react-zoom-pan-pinch";
import {BlockIO} from "../../common/VMS";
import {VMSBlockProps} from "./Block";
import {ArrowProps, BlockConnections} from "./BlockConnections";
import {DraggableBlock} from "./DraggableBlock";

export interface StartedArrowPosition {
    blockPosition: ControlPosition;
    io: BlockIO;
}

export interface EditorCanvasProps {
    arrows: ArrowProps[];
    blocks: VMSBlockProps[];
    startedArrow?: StartedArrowPosition;
    onAuxClick?: MouseEventHandler;
}

function useRelativeMousePosition(relative: RefObject<HTMLDivElement>): [number, number] {
    const [currentX, setCurrentX] = useState(0);
    const [currentY, setCurrentY] = useState(0);
    const setMousePosition = (ev: globalThis.MouseEvent) => {
        if (relative.current) {
            setCurrentX(ev.clientX - relative.current.getBoundingClientRect().left);
            setCurrentY(ev.clientY - relative.current.getBoundingClientRect().top);
        }
    };
    useEffect(() => {
        window.addEventListener('mousemove', setMousePosition);
        return () => window.removeEventListener('mousemove', setMousePosition);
    }, []);
    return [currentX, currentY];
}

export function VMSEditorCanvas(props: EditorCanvasProps) {
    const mouseOwnerRef = useRef<HTMLDivElement>();
    const [mouseX, mouseY] = useRelativeMousePosition(mouseOwnerRef);
    const [draggingElement, setDraggingElement] = useState(false);
    const [scale, setScale] = useState(1);
    const wrappedBlocks = props.blocks.map((block, i) => <DraggableBlock
        {...block} setDragging={setDraggingElement} scale={scale} key={i}
    />);
    const arrows = [...props.arrows];
    if (props.startedArrow) {
        console.log(props.startedArrow);
        arrows.push({
            fromBlock: props.startedArrow.blockPosition,
            fromOutput: props.startedArrow.io,
            toBlock: {x: mouseX / scale, y: mouseY / scale},
            toType: 'none',
        });
    }
    return <TransformWrapper
        disabled={draggingElement}
        // TODO somehow make sure that the "bounds" are the same for all screen/window sizes
        limitToBounds={true}
        onTransformed={(_, data) => setScale(data.scale)}
    >
        <TransformComponent wrapperStyle={{position: 'relative', height: '100%', width: '100%'}}>
            <div style={{position: 'absolute', zIndex: 0, height: '100vh', width: '100vw'}}>
                <BlockConnections arrows={arrows}/>
            </div>
            <div
                style={{position: 'relative', zIndex: 1, height: '100vh', width: '100vw'}}
                ref={mouseOwnerRef}
                onAuxClick={props.onAuxClick}
            >
                {wrappedBlocks}
            </div>
        </TransformComponent>
    </TransformWrapper>;
}
