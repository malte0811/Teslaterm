import React, {RefObject, useEffect, useRef, useState} from "react";
import {ControlPosition} from "react-draggable";
import {BlockIO} from "../../common/VMS";
import {INPUT_CENTER_X_OFFSET} from "./VMSBlockOffsets";

export interface ArrowProps {
    startPosition: ControlPosition;
    fromIO: BlockIO;
    toBlock?: ControlPosition;
}

export interface ScaleAndOffset {
    // Top-left corner in absolute coordinates
    position: ControlPosition;
    // Image content is scaled by this
    scale: number;
}

interface FullArrowProps extends ArrowProps {
    mousePos: ControlPosition;
    transform: ScaleAndOffset;
}

function Arrow(props: FullArrowProps) {
    const bigM = 100;
    const[fromCtrlX, fromCtrlY] = (() => {
        if (props.fromIO === 'off') {
            return [-bigM, 0];
        } else if (props.fromIO === 'in') {
            return [0, -bigM];
        } else {
            return [0, bigM];
        }
    })();
    const scale = props.transform.scale;
    const globalOffset = props.transform.position;
    const realTo = (() => {
        if (props.toBlock !== undefined) {
            return {x: props.toBlock.x + INPUT_CENTER_X_OFFSET, y: props.toBlock.y};
        } else {
            return {x: (props.mousePos.x - globalOffset.x) / scale, y: (props.mousePos.y - globalOffset.y) / scale};
        }
    })();
    const pt = (point: ControlPosition, xOff: number = 0, yOff: number = 0) => {
        const realX = (point.x + xOff) * scale + globalOffset.x;
        const realY = (point.y + yOff) * scale + globalOffset.y;
        return `${realX} ${realY}`;
    };
    const pathStart = `M ${pt(props.startPosition)}`;
    const pathToEnd = `C ${pt(props.startPosition, fromCtrlX, fromCtrlY)} ${pt(realTo, 0, -bigM)} ${pt(realTo)}`;
    const color = props.fromIO === 'off' ? 'red' : 'blue';
    return <path d={`${pathStart} ${pathToEnd}`} stroke={color} fill={'transparent'} strokeWidth={4}/>;
}

function useRelativeMousePosition(relative: RefObject<SVGSVGElement>): ControlPosition {
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
    return {x: currentX, y: currentY};
}

export function BlockConnections({arrows, transform}: {arrows: ArrowProps[], transform: ScaleAndOffset}) {
    const ref = useRef<SVGSVGElement>(undefined);
    const mousePos = useRelativeMousePosition(ref);
    return <svg width="100%" height="100%" ref={ref}>
        {arrows.map((props, i) => <Arrow {...props} mousePos={mousePos} key={i} transform={transform}/>)}
    </svg>;
}

