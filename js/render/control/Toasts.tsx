import React from "react";
import {Toast, ToastContainer} from "react-bootstrap";
import {CoilID} from "../../common/constants";
import {IPC_CONSTANTS_TO_RENDERER, ToastData, ToastSeverity} from "../../common/IPCConstantsToRenderer";
import {TTComponent} from "../TTComponent";
import {ShownToastData} from "./ToastManager";

export interface ToastsProps {
    darkMode: boolean;
    closeToast: (toast: ShownToastData) => any;
    toasts: ShownToastData[];
}

export class Toasts extends TTComponent<ToastsProps, {}> {
    public componentDidMount() {
    }

    public render() {
        return <ToastContainer position={'bottom-end'}>
            {this.props.toasts.map((d, i) => this.makeToast(d))}
        </ToastContainer>;
    }

    private makeToast(data: ShownToastData) {
        return <Toast
            onClose={() => this.props.closeToast(data)}
            bg={this.getStyleFor(data.level)}
            key={data.uniqueIndex}
            className={'me-2 tt-' + (this.props.darkMode ? 'dark' : 'light') + '-toast'}
        >
            <Toast.Header>
                <div className={'me-auto'}>{data.title}</div>
                {data.occurrences > 1 && <small>Seen {data.occurrences} times</small>}
            </Toast.Header>
            <Toast.Body>{data.message}</Toast.Body>
        </Toast>;
    }

    private getStyleFor(level: ToastSeverity) {
        switch (level) {
            case ToastSeverity.info:
                return this.props.darkMode ? 'dark' : 'light';
            case ToastSeverity.warning:
                return 'warning';
            case ToastSeverity.error:
                return 'danger';
        }
    }
}
