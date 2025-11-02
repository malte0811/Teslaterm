import React, {useEffect, useRef} from "react";

export interface CanvasProps {
    render: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
    renderDeps: React.DependencyList;
}

export function CanvasComponent(props: CanvasProps) {
    const canvasRef: React.RefObject<HTMLCanvasElement> = useRef();
    const divRef: React.RefObject<HTMLDivElement> = useRef();
    const refresh = () => {
        const canvas = canvasRef.current;
        const div = divRef.current;
        const ctx = canvas && canvas.getContext('2d');
        if (!canvas || !div || !ctx) {
            return;
        }
        canvas.height = div.offsetHeight;
        canvas.width = div.offsetWidth;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        props.render(ctx, canvas.width, canvas.height);
    };
    useEffect(refresh, [props.renderDeps]);
    const resizeObserver: ResizeObserver = new ResizeObserver(refresh);
    useEffect(() => {
        const div = divRef.current;
        resizeObserver.observe(div);
        return () => resizeObserver.unobserve(div);
    }, []);
    return <div ref={divRef} style={{width: '100%', height: '100%'}}>
        <canvas ref={canvasRef} className={'tt-canvas'}/>
    </div>;
}
