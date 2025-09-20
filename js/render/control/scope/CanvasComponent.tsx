import React, {useEffect, useRef} from "react";
import {TTComponent} from "../../TTComponent";

export abstract class CanvasComponent<Props, State> extends TTComponent<Props, State> {
    private readonly canvasRef: React.RefObject<HTMLCanvasElement>;
    private readonly divRef: React.RefObject<HTMLDivElement>;
    private readonly resizeObserver: ResizeObserver;

    public constructor(props: any) {
        super(props);
        this.canvasRef = React.createRef();
        this.divRef = React.createRef();
        this.resizeObserver = new ResizeObserver(() => this.refresh());
    }

    public render(): React.ReactNode {
        return <div ref={this.divRef}>
            <canvas ref={this.canvasRef} className={'tt-canvas'}/>
        </div>;
    }

    public componentDidMount() {
        this.resizeObserver.observe(this.canvasRef.current);
        this.refresh();
    }

    public componentWillUnmount() {
        super.componentWillUnmount();
        this.resizeObserver.unobserve(this.canvasRef.current);
    }

    public componentDidUpdate(prevProps: Props) {
        this.refresh();
    }

    protected abstract draw(ctx: CanvasRenderingContext2D, width: number, height: number);

    private refresh() {
        const canvas = this.canvasRef.current;
        const div = this.divRef.current;
        const ctx = canvas && canvas.getContext('2d');
        if (!canvas || !div || !ctx) {
            return;
        }
        canvas.height = div.offsetHeight;
        canvas.width = div.offsetWidth;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        this.draw(ctx, canvas.width, canvas.height);
    }
}

export interface CanvasProps {
    render: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
    renderDeps: React.DependencyList;
}

export function NewCanvasComponent(props: CanvasProps) {
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
