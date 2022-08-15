import React from "react";
import ReactDOM from "react-dom/client";
import {IPC_CONSTANTS_TO_MAIN} from "../common/IPCConstantsToMain";
import {ConnectionStatus, IPC_CONSTANTS_TO_RENDERER} from "../common/IPCConstantsToRenderer";
import {TTConfig} from "../common/TTConfig";
import {ConnectScreen} from "./connect/ConnectScreen";
import {MainScreen} from "./control/MainScreen";
import {processIPC} from "./ipc/IPCProvider";
import {TTComponent} from "./TTComponent";
import {loadUIConfig, storeUIConfig, UIConfig} from "./UIConfig";

interface TopLevelState {
    connectionStatus: ConnectionStatus;
    ttConfig: TTConfig;
    // If connection is lost, it may be because the UD3 died. In that case we want to stay on the "main" screen so the
    // last telemetry is still visible.
    wasConnected: boolean;
    uiConfig: UIConfig;
}

export class App extends TTComponent<{}, TopLevelState> {
    constructor(props: any) {
        super(props);
        this.state = {
            connectionStatus: ConnectionStatus.IDLE,
            ttConfig: undefined,
            wasConnected: false,
            uiConfig: loadUIConfig(),
        };
        storeUIConfig(this.state.uiConfig);
    }

    componentDidMount() {
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.updateConnectionState, status => this.onConnectionChange(status)
        );
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.ttConfig, (cfg) => this.setState({ttConfig: cfg})
        );
        processIPC.send(IPC_CONSTANTS_TO_MAIN.requestFullSync, undefined);
    }

    render(): React.ReactNode {
        return <div className={this.state.uiConfig.darkMode ? 'tt-dark-root' : 'tt-light-root'}>
            {this.getMainElement()}
        </div>
    }

    private getMainElement(): JSX.Element {
        if (!this.state.ttConfig) {
            return <>Initializing...</>;
        } else if (this.state.wasConnected) {
            return <MainScreen
                ttConfig={this.state.ttConfig}
                connectionStatus={this.state.connectionStatus}
                clearWasConnected={() => this.setState({wasConnected: false})}
                darkMode={this.state.uiConfig.darkMode}
            />;
        } else if (this.state.connectionStatus == ConnectionStatus.CONNECTING || this.state.connectionStatus == ConnectionStatus.IDLE) {
            return <ConnectScreen
                ttConfig={this.state.ttConfig}
                connecting={this.state.connectionStatus === ConnectionStatus.CONNECTING}
                darkMode={this.state.uiConfig.darkMode}
                setDarkMode={newVal => {
                    const newConfig: UIConfig = {...this.state.uiConfig, darkMode: newVal};
                    storeUIConfig(newConfig);
                    this.setState({uiConfig: newConfig});
                }}
            />;
        } else {
            return <>Unsupported status {this.state.connectionStatus} :(</>;
        }
    }

    private onConnectionChange(newState: ConnectionStatus) {
        this.setState(oldState => ({
            connectionStatus: newState,
            wasConnected: oldState.wasConnected || newState == ConnectionStatus.CONNECTED
        }));
    }
}

export function init() {
    document.addEventListener('DOMContentLoaded', () => {
        const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
        root.render(<React.StrictMode><App/></React.StrictMode>);
    });
}
