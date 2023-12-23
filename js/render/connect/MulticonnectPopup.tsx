import {Button, Form, FormCheck, Modal} from "react-bootstrap";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {ConnectionPreset} from "../../common/IPCConstantsToRenderer";
import {processIPC} from "../ipc/IPCProvider";
import {TTComponent} from "../TTComponent";
import {ConnectionPresets} from "./ConnectionPresets";

export interface MulticonnectProps {
    darkMode: boolean;
    presets: ConnectionPreset[];
    visible: boolean;
    close: () => any;
}

interface MulticonnectState {
    selected: boolean[];
}

// TODO need a close/abort button
export class MulticonnectPopup extends TTComponent<MulticonnectProps, MulticonnectState> {
    constructor(props) {
        super(props);
        this.state = {selected: []};
    }

    public render() {
        const checkboxes = this.props.presets.map((preset, i) => (
            <Form.Check
                type={'checkbox'}
                key={i}
                onChange={ev => this.setSelected(i, ev.target.checked)}
                checked={this.isSelected(i)}
                label={preset.name}
                title={ConnectionPresets.makeTooltip(preset)}
            />
        ));
        return <Modal
            show={this.props.visible}
            size={"lg"}
            className={this.props.darkMode && 'tt-dark-modal-root'}
        >
            <Modal.Header>Connect to multiple coils</Modal.Header>
            <Modal.Body>{...checkboxes}</Modal.Body>
            <Modal.Footer>
                <Button onClick={() => this.connect()}>Connect</Button>
                <Button onClick={() => {
                    this.setState({selected: []});
                    this.props.close();
                }}>Close</Button>
            </Modal.Footer>
        </Modal>;
    }

    private isSelected(id: number): boolean {
        return this.state.selected[id] === true;
    }

    private setSelected(id: number, checked: boolean) {
        this.setState((oldState) => {
            const newSelected = [...oldState.selected];
            while (newSelected.length <= id) {
                newSelected.push(false);
            }
            newSelected[id] = checked;
            return {selected: newSelected};
        });
    }

    private connect() {
        this.props.presets.forEach((preset, i) => {
            if (this.isSelected(i)) {
                processIPC.send(IPC_CONSTANTS_TO_MAIN.connect.connect, preset.options);
            }
        });
    }
}
