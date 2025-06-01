import React from "react";
import {Toast, ToastContainer} from "react-bootstrap";
import {ToastSeverity} from "../../common/IPCConstantsToRenderer";
import {TTComponent} from "../TTComponent";
import {ShownToastData} from "./ToastManager";

export interface ToastsProps {
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
            className={'me-2'}
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
                return undefined;
            case ToastSeverity.warning:
                return 'warning';
            case ToastSeverity.error:
                return 'danger';
        }
    }
}
