import React, {useEffect} from "react";
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

export function useDropCallback<T extends HTMLElement>(
    mainDiv: React.RefObject<T | undefined>, onDrop: (e: DragEvent) => Promise<any>,
) {
    useEffect(() => {
        const div = mainDiv.current;
        if (!div) { return; }
        const dropListener = (e: DragEvent) => {
            e.stopPropagation();
            e.preventDefault();
            onDrop(e).catch((err) => console.error('While processing dropped files:', err));
        };
        const dragoverListener = (e: DragEvent) => {
            e.stopPropagation();
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
        };
        div.addEventListener('dragover', dragoverListener);
        div.addEventListener('drop', dropListener);
        return () => {
            div.removeEventListener('dragover', dragoverListener);
            div.removeEventListener('drop', dropListener);
        };
    }, [onDrop, mainDiv]);
}
