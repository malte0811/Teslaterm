import React from "react";
import {TTComponent} from "./TTComponent";

export abstract class ScreenWithDrop<Props, State> extends TTComponent<Props, State> {
    protected readonly mainDivRef: React.RefObject<HTMLDivElement>;
    private readonly dropListener: (e: DragEvent) => any;
    private readonly dragoverListener: (e: DragEvent) => any;

    protected constructor(props: any) {
        super(props);
        this.mainDivRef = React.createRef();
        this.dropListener = (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.onDrop(e).catch((err) => console.error('While processing dropped files:', err));
        };
        this.dragoverListener = (e: DragEvent) => {
            e.stopPropagation();
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
        };
    }

    public componentDidMount() {
        if (this.mainDivRef.current) {
            this.mainDivRef.current.addEventListener('dragover', this.dragoverListener);
            this.mainDivRef.current.addEventListener('drop', this.dropListener);
        }
    }

    public componentWillUnmount() {
        super.componentWillUnmount();
        if (this.mainDivRef.current) {
            this.mainDivRef.current.removeEventListener('dragover', this.dragoverListener);
            this.mainDivRef.current.removeEventListener('drop', this.dropListener);
        }
    }

    protected abstract onDrop(e: DragEvent): Promise<any>;
}
