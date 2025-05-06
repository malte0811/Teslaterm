import {Button, Form, Modal} from "react-bootstrap";
import {IPC_CONSTANTS_TO_MAIN} from "../../../common/IPCConstantsToMain";
import {processIPC} from "../../ipc/IPCProvider";
import {TTComponent} from "../../TTComponent";

export interface TelemetrySelectorProps {
    shown: boolean;
    availableNames: string[];
    close: () => any;
    darkMode: boolean;
}

interface TelemetrySelectorState {
    selected: boolean[];
}

export class TelemetrySelector extends TTComponent<TelemetrySelectorProps, TelemetrySelectorState> {
    constructor(props) {
        super(props);
        this.state = {selected: []};
    }

    public render() {
        // TODO manual order specification?
        const checkboxes = this.props.availableNames.map(
            (name, id) => <Form.Check
                type={'checkbox'}
                key={id}
                id={id.toString()}
                onChange={ev => this.setSelected(id, ev.target.checked)}
                checked={this.state.selected[id]}
                label={name}
            />,
        );
        return (
            <Modal
                show={this.props.shown}
                size={"lg"}
                className={this.props.darkMode && 'tt-dark-modal-root'}
            >
                <Modal.Header>Select telemetry to show</Modal.Header>
                <Modal.Body>{...checkboxes}</Modal.Body>
                <Modal.Footer>
                    <Button onClick={() => this.setAndClose()}>Select</Button>
                    <Button onClick={() => this.close()}>Abort</Button>
                </Modal.Footer>
            </Modal>
        );
    }

    private setSelected(i: number, checked: boolean) {
        this.setState((oldState) => {
            const newSelected = [...oldState.selected];
            newSelected[i] = checked;
            return {selected: newSelected};
        });
    }

    private setAndClose() {
        processIPC.send(
            IPC_CONSTANTS_TO_MAIN.centralTab.setCentralTelemetry,
            this.props.availableNames.filter((_, i) => this.state.selected[i]),
        );
        this.close();
    }

    private close() {
        this.setState({selected: []});
        this.props.close();
    }
}
