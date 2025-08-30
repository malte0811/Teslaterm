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

interface ConnectionProps extends ArrowProps {
    mousePos: ControlPosition;
    transform: ScaleAndOffset;
}

export function logicToScreenCoords(xGlobal: number, yGlobal: number, transform: ScaleAndOffset): ControlPosition {
    return {
        x: xGlobal * transform.scale + transform.position.x,
        y: yGlobal * transform.scale + transform.position.y,
    };
}

export function screenToLogicCoords(screenPos: ControlPosition, transform: ScaleAndOffset): ControlPosition {
    return {
        x: (screenPos.x - transform.position.x) / transform.scale,
        y: (screenPos.y - transform.position.y) / transform.scale,
    };
}

function Connection(props: ConnectionProps) {
    const bigM = 100;
    const [fromCtrlX, fromCtrlY] = (() => {
        if (props.fromIO === 'off') {
            return [-bigM, 0];
        } else if (props.fromIO === 'in') {
            return [0, -bigM];
        } else {
            return [0, bigM];
        }
    })();
    const realTo = (() => {
        if (props.toBlock !== undefined) {
            return {x: props.toBlock.x + INPUT_CENTER_X_OFFSET, y: props.toBlock.y};
        } else {
            return screenToLogicCoords(props.mousePos, props.transform);
        }
    })();
    const pt = (point: ControlPosition, xOff: number = 0, yOff: number = 0) => {
        const {x, y} = logicToScreenCoords(point.x + xOff, point.y + yOff, props.transform);
        return `${x} ${y}`;
    };
    const pathStart = `M ${pt(props.startPosition)}`;
    const pathToEnd = `C ${pt(props.startPosition, fromCtrlX, fromCtrlY)} ${pt(realTo, 0, -bigM)} ${pt(realTo)}`;
    const color = props.fromIO === 'off' ? 'red' : 'blue';
    return <path d={`${pathStart} ${pathToEnd}`} stroke={color} fill={'transparent'}/>;
}

function StartConnection({startPos, transform}: {startPos: ControlPosition, transform: ScaleAndOffset}) {
    const strokeTo = logicToScreenCoords(startPos.x, startPos.y - 6, transform);
    const strokeFrom = logicToScreenCoords(startPos.x, startPos.y - 30, transform);
    return <path
        stroke={'green'}
        fill={'transparent'}
        d={`M ${strokeFrom.x} ${strokeFrom.y} L ${strokeTo.x} ${strokeTo.y}`}
        markerEnd="url(#arrow)"
    />;
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

export interface BlockConnectionProps {
    arrows: ArrowProps[];
    transform: ScaleAndOffset;
    startPos?: ControlPosition;
}

export function BlockConnections(props: BlockConnectionProps) {
    const ref = useRef<SVGSVGElement>(undefined);
    const mousePos = useRelativeMousePosition(ref);
    const scale = props.transform.scale;
    return <svg width="100%" height="100%" ref={ref} strokeWidth={4 * scale}>
        <defs>
            <marker
                id="arrow"
                viewBox={`0 0 ${10 * scale} ${10 * scale}`}
                refX={5 * scale}
                refY={5 * scale}
                markerWidth={5}
                markerHeight={10}
                fill='context-stroke'
                orient="auto-start-reverse">
                <path d={`M 0 0 L ${10 * scale} ${5 * scale} L 0 ${10 * scale} z`}/>
            </marker>
        </defs>
        {props.arrows.map(
            (innerProps, i) => <Connection {...innerProps} mousePos={mousePos} key={i} transform={props.transform}/>,
        )}
        {props.startPos && <StartConnection startPos={props.startPos} transform={props.transform}/>}
    </svg>;
}

