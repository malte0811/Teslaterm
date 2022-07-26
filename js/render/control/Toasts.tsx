import React from "react";
import {Toast, ToastContainer} from "react-bootstrap";
import {IPC_CONSTANTS_TO_RENDERER, ToastData, ToastSeverity} from "../../common/IPCConstantsToRenderer";
import {TTComponent} from "../TTComponent";

interface ToastsState {
    toasts: ToastData[];
}

export class Toasts extends TTComponent<{}, ToastsState> {
    constructor(props) {
        super(props);
        this.state = {
            toasts: [],
        };
    }

    componentDidMount() {
        this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.openToast, (arg: ToastData) => {
            this.setState((oldState) => {
                if (arg.level == ToastSeverity.info) {
                    // Manual implementation of autohide, since the default one seems to have issues with dynamic
                    // indices
                    setTimeout(() => this.setState((state) => {
                        const indexToRemove = state.toasts.indexOf(arg);
                        if (indexToRemove >= 0) {
                            return {toasts: state.toasts.filter((_, i) => i != indexToRemove)};
                        }
                    }), 3000);
                }
                return {toasts: [...oldState.toasts, arg]};
            });
        });
    }

    render() {
        return <ToastContainer position={'bottom-end'}>
            {this.state.toasts.map((d, i) => this.makeToast(d, i))}
        </ToastContainer>;
    }

    private makeToast(data: ToastData, index: number) {
        return <Toast
            onClose={() => this.setState({toasts: this.state.toasts.filter((_, i) => i != index)})}
            bg={Toasts.getStyleFor(data.level)}
            key={index}
        >
            <Toast.Header>{data.title}</Toast.Header>
            <Toast.Body>{data.message}</Toast.Body>
        </Toast>;
    }

    private static getStyleFor(level: ToastSeverity) {
        switch (level) {
            case ToastSeverity.info:
                return 'light';
            case ToastSeverity.warning:
                return 'warning';
            case ToastSeverity.error:
                return 'danger';
        }
    }
}
