import {Button, Form, Modal} from "react-bootstrap";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {ConnectionPreset} from "../../common/IPCConstantsToRenderer";
import {AdvancedOptions} from "../../common/Options";
import {processIPC} from "../ipc/IPCProvider";
import {TTComponent} from "../TTComponent";
import {AdvancedOptionsForm} from "./AdvancedOptionsForm";
import {ConnectionPresets} from "./ConnectionPresets";

export interface MulticonnectProps {
    presets: ConnectionPreset[];
    visible: boolean;
    close: () => any;
    advanced: AdvancedOptions;
    setAdvanced: (newCfg: Partial<AdvancedOptions>) => any;
}

interface MulticonnectState {
    selected: boolean[];
}

export class MulticonnectPopup extends TTComponent<MulticonnectProps, MulticonnectState> {
    constructor(props) {
        super(props);
        this.state = {
            selected: [],
        };
    }

    public render() {
        const checkboxes = this.props.presets.map((preset, i) => (
            <Form.Check
                type={'checkbox'}
                key={i}
                id={i.toString()}
                onChange={ev => this.setSelected(i, ev.target.checked)}
                checked={this.isSelected(i)}
                label={preset.name}
                title={ConnectionPresets.makeTooltip(preset)}
            />
        ));
        return <Modal
            show={this.props.visible}
            size={"lg"}
        >
            <Modal.Header>Connect to multiple coils</Modal.Header>
            <Modal.Body>
                {...checkboxes}
                <AdvancedOptionsForm
                    currentOptions={this.props.advanced}
                    setOptions={this.props.setAdvanced}
                    connecting={false}
                    keyPrefix={'multiconnect-advanced'}
                    showMixer={true}
                />
            </Modal.Body>
            <Modal.Footer>
                <Button
                    onClick={() => this.connect()}
                    disabled={this.getSelectedOptions().length < 1}
                >Connect</Button>
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
        processIPC.send(IPC_CONSTANTS_TO_MAIN.connect.multiconnect, {
            advanced: this.props.advanced,
            ud3Options: this.getSelectedOptions(),
        });
    }

    private getSelectedOptions() {
        return this.props.presets.filter((_, i) => this.isSelected(i))
            .map((preset) => preset.options);
    }
}
