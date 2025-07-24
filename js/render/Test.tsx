import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import Draggable from 'react-draggable';
import { useState } from "react";
import { BlockComponent } from "./vms/Block";

export function VMSTest() {
    const[draggingElement, setDraggingElement] = useState(false);
    const makeDraggable = () => {
        return <Draggable
            handle=".handle"
            defaultPosition={{x: 0, y: 0}}
            position={null}
            scale={1}
            onDrag={() => setDraggingElement(true)}
            onStop={() => setDraggingElement(false)}
        >
            <div>
                <div className="handle"><BlockComponent/></div>
            </div>
        </Draggable>
    };
    return <div style={{height: '100vh', width: '100vw'}}>
        <TransformWrapper disabled={draggingElement} limitToBounds={false}>
            <TransformComponent wrapperStyle={{height: '100vh', width: '100vw'}}>
                {makeDraggable()}
                {makeDraggable()}
            </TransformComponent>
        </TransformWrapper>
    </div>
}
