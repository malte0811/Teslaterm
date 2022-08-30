import {Button, ButtonGroup, Form} from "react-bootstrap";
import {CONNECTION_TYPE_DESCS, UD3ConnectionType} from "../../common/constants";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {ConnectionPreset, IPC_CONSTANTS_TO_RENDERER} from "../../common/IPCConstantsToRenderer";
import {processIPC} from "../ipc/IPCProvider";
import {TTComponent} from "../TTComponent";
import {MergedConnectionOptions, toSingleOptions} from "./ConnectScreen";

export interface PresetsProps {
    mainFormProps: MergedConnectionOptions;
    setMainFormProps: (opts: Partial<MergedConnectionOptions>) => any;
    connecting: boolean;
    darkMode: boolean;
}

interface PresetsState {
    presets: ConnectionPreset[];
    newEntryName: string;
}

export class ConnectionPresets extends TTComponent<PresetsProps, PresetsState> {
    constructor(props) {
        super(props);
        this.state = {
            presets: [],
            newEntryName: '',
        };
    }

    componentDidMount() {
        this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.connect.syncPresets, (presets) => this.setState({presets}));
        processIPC.send(IPC_CONSTANTS_TO_MAIN.connect.getPresets, undefined);
    }

    render() {
        let presetList = this.state.presets.length > 0 && (
            <div className={'tt-preset-list'}>
                {this.state.presets.map((preset) => this.makePresetEntry(preset))}
            </div>
        );
        return (
            <div className={'tt-connect-presets'}>
                {this.makeNewEntryField()}
                {presetList}
            </div>
        );
    }

    private makePresetEntry(preset: ConnectionPreset) {
        const load = () => this.props.setMainFormProps({
            currentType: preset.options.connectionType, ...preset.options.options
        });
        const connect = () => {
            load();
            processIPC.send(IPC_CONSTANTS_TO_MAIN.connect.connect, preset.options);
        };
        const deletePreset = () => {
            const newPresets = this.state.presets.filter((cp) => cp != preset);
            processIPC.send(IPC_CONSTANTS_TO_MAIN.connect.setPresets, newPresets);
        };
        let description = `Type: ${CONNECTION_TYPE_DESCS.get(preset.options.connectionType)}`;
        switch (preset.options.connectionType) {
            case UD3ConnectionType.serial_min:
            case UD3ConnectionType.serial_plain:
                if (preset.options.options.serialPort) {
                    description += `\nPort: ${preset.options.options.serialPort}`;
                } else {
                    description += `\nVendor ID: ${preset.options.options.autoVendorID}`;
                    description += `\nProduct ID: ${preset.options.options.autoProductID}`;
                }
                description += `\nBaudrate: ${preset.options.options.baudrate}`;
                break;
            case UD3ConnectionType.udp_min:
                description += `\nRemote IP: ${preset.options.options.remoteIP}`;
                description += `\nRemote port: ${preset.options.options.udpMinPort}`;
                break;
        }
        return <div className={'tt-side-aligned tt-connect-preset'} title={description} key={preset.name}>
            <span className={'tt-align-left'}>{preset.name}</span>
            <ButtonGroup>
                <Button disabled={this.props.connecting} onClick={load}>Load</Button>
                <Button disabled={this.props.connecting} onClick={connect}>Connect</Button>
                <Button disabled={this.props.connecting} onClick={deletePreset} variant={'danger'}>Delete</Button>
            </ButtonGroup>
        </div>;
    }

    private makeNewEntryField() {
        const realName = this.state.newEntryName.trim();
        const canAdd = realName.length > 0 && this.state.presets.filter(preset => preset.name == realName).length == 0;
        return <Form className={'tt-side-aligned'} onSubmit={e => e.preventDefault()}>
            <Form.Control
                style={({width: '50%'})}
                value={this.state.newEntryName}
                disabled={this.props.connecting}
                onChange={(s) => this.setState({newEntryName: s.target.value})}
                className={'tt-align-left ' + (this.props.darkMode ? 'tt-dark-form-input' : 'tt-light-form-input')}
            />
            <Button
                disabled={this.props.connecting || !canAdd}
                onClick={() => this.addNewPreset()}
                type={'submit'}
            >Add preset</Button>
        </Form>;
    }

    private addNewPreset() {
        const newPreset: ConnectionPreset = {
            name: this.state.newEntryName.trim(), options: toSingleOptions(this.props.mainFormProps),
        };
        processIPC.send(IPC_CONSTANTS_TO_MAIN.connect.setPresets, [...this.state.presets, newPreset]);
        this.setState({newEntryName: ''});
    }
}
