import {CSSProperties, useRef, useState} from "react";
import Draggable, {ControlPosition} from 'react-draggable';
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { BlockComponent } from "./vms/Block";

function Background({from, to}: {from: ControlPosition, to: ControlPosition}) {
    const realFrom = {x: from.x + 20, y: from.y + 150};
    const realTo = {x: to.x + 50, y: to.y};
    const pt = (point: ControlPosition, xOff: number = 0, yOff: number = 0) => `${point.x + xOff} ${point.y + yOff}`;
    const pathStart = `M ${pt(realFrom)}`;
    const bigM = 100;
    const pathToEnd = `C ${pt(realFrom, 0, bigM)} ${pt(realTo, 0, -bigM)} ${pt(realTo)}`;
    return <svg width="100%" height="100%">
        <path d={`${pathStart} ${pathToEnd}`} stroke={'black'} fill={'transparent'} strokeWidth={4}/>
    </svg>;
}

interface DraggableProps {
    setDragging: (b: boolean) => void;
    scale: number;
    setPosition: (p: ControlPosition) => void;
    position: ControlPosition;
}

function DragStuff(props: DraggableProps) {
    const nodeRef = useRef(null);
    const style: CSSProperties = {
        height: 'min-content',
        left: '0',
        position: 'absolute',
        top: '0',
        width: 'min-content',
    };
    return <Draggable
        defaultPosition={{x: 0, y: 0}}
        position={props.position}
        scale={props.scale}
        onDrag={(_, data) => {
            props.setDragging(true);
            props.setPosition({x: data.x, y: data.y});
        }}
        onStop={(_, data) => {
            props.setDragging(false);
            props.setPosition({x: data.x, y: data.y});
        }}
        nodeRef={nodeRef}
    >
        <div ref={nodeRef} style={style}><BlockComponent/></div>
    </Draggable>;
}

export function VMSTest() {
    const [draggingElement, setDraggingElement] = useState(false);
    const [scale, setScale] = useState(1);
    const [posFirst, setPosFirst] = useState<ControlPosition>({x: 0, y: 0});
    const [posSec, setPosSec] = useState<ControlPosition>({x: 100, y: 0});

    const capturedDraggable = (pos: ControlPosition, setPos: (p: ControlPosition) => void) => {
        return <DragStuff
            setDragging={setDraggingElement}
            scale={scale}
            position={pos}
            setPosition={setPos}
        />;
    };
    return <TransformWrapper
        disabled={draggingElement}
        limitToBounds={false}
        onTransformed={(_, data) => setScale(data.scale)}
    >
        <TransformComponent wrapperStyle={{position: 'relative', height: '100%', width: '100%'}}>
            <div style={{position: 'absolute', zIndex: 0, height: '100vh', width: '100vw'}}>
                <Background from={posFirst} to={posSec}/>
            </div>
            <div style={{position: 'relative', zIndex: 1, height: '100vh', width: '100vw'}}>
                {capturedDraggable(posFirst, setPosFirst)}
                {capturedDraggable(posSec, setPosSec)}
            </div>
        </TransformComponent>
    </TransformWrapper>;
}
