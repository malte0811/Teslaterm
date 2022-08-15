import React from "react";
import {Toast, ToastContainer} from "react-bootstrap";
import {IPC_CONSTANTS_TO_RENDERER, ToastData, ToastSeverity} from "../../common/IPCConstantsToRenderer";
import {TTComponent} from "../TTComponent";

interface ShownToastData extends ToastData {
    hideTimeout?: NodeJS.Timeout;
    occurrences: number;
}

export interface ToastsProps {
    darkMode: boolean;
}

interface ToastsState {
    toasts: ShownToastData[];
}

export class Toasts extends TTComponent<ToastsProps, ToastsState> {
    constructor(props) {
        super(props);
        this.state = {
            toasts: [],
        };
    }

    componentDidMount() {
        this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.openToast, (arg: ToastData) => {
            this.setState((oldState) => {
                const newToasts: ShownToastData[] = [...oldState.toasts];
                let occurrences = 1;
                if (arg.mergeKey !== undefined) {
                    for (let i = 0; i < newToasts.length; ++i) {
                        if (arg.mergeKey === newToasts[i].mergeKey) {
                            occurrences += newToasts[i].occurrences;
                            if (newToasts[i].hideTimeout !== undefined) {
                                clearTimeout(newToasts[i].hideTimeout);
                            }
                            newToasts.splice(i, 1);
                            break;
                        }
                    }
                }
                const newToast: ShownToastData = {occurrences: occurrences, ...arg};
                if (arg.level == ToastSeverity.info) {
                    // Manual implementation of autohide, since the default one seems to have issues with dynamic
                    // indices
                    newToast.hideTimeout = setTimeout(() => this.setState((state) => {
                        const indexToRemove = state.toasts.indexOf(newToast);
                        if (indexToRemove >= 0) {
                            return {toasts: state.toasts.filter((_, i) => i != indexToRemove)};
                        }
                    }), 3000);
                }
                newToasts.push(newToast);
                return {toasts: newToasts};
            });
        });
    }

    render() {
        return <ToastContainer position={'bottom-end'}>
            {this.state.toasts.map((d, i) => this.makeToast(d, i))}
        </ToastContainer>;
    }

    private makeToast(data: ShownToastData, index: number) {
        return <Toast
            onClose={() => this.setState({toasts: this.state.toasts.filter((_, i) => i != index)})}
            bg={this.getStyleFor(data.level)}
            key={index}
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
