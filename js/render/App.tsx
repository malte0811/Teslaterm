import React from "react";
import ReactDOM from "react-dom/client";
import {FitAddon} from "xterm-addon-fit";
import {CoilID} from "../common/constants";
import {IPC_CONSTANTS_TO_MAIN} from "../common/IPCConstantsToMain";
import {ConnectionStatus, IPC_CONSTANTS_TO_RENDERER} from "../common/IPCConstantsToRenderer";
import {TTConfig} from "../common/TTConfig";
import {ConnectScreen, FRDisplayData} from "./connect/ConnectScreen";
import {MainScreen} from "./control/MainScreen";
import {FlightRecordingScreen} from "./flightrecord/FlightRecordingScreen";
import {processIPC} from "./ipc/IPCProvider";
import {TTComponent} from "./TTComponent";

enum TopScreen {
    connect,
    control,
    flight_recording,
}

interface TopLevelState {
    screen: TopScreen;
    flightEvents?: FRDisplayData;
    ttConfig: TTConfig;
    darkMode: boolean;
    coils: CoilID[];
}

export class App extends TTComponent<{}, TopLevelState> {
    constructor(props: any) {
        super(props);
        this.state = {
            coils: [],
            darkMode: false,
            screen: TopScreen.connect,
            ttConfig: undefined,
        };
    }

    public componentDidMount() {
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.ttConfig, (cfg) => this.setState({ttConfig: cfg}),
        );
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.ttConfig, (cfg) => this.setState({ttConfig: cfg}),
        );
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.syncDarkMode, (darkMode) => this.setState({darkMode}),
        );
        processIPC.send(IPC_CONSTANTS_TO_MAIN.requestFullSync, undefined);
        this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.registerCoil, (coil) => {
            if (!this.state.coils.includes(coil)) {
                this.setState({
                    coils: [...this.state.coils, coil],
                    // TODO this should only happen once connect is done
                    screen: TopScreen.control,
                });
            }
        });
    }

    public render(): React.ReactNode {
        return <>
            <div className={this.state.darkMode ? 'tt-dark-root' : 'tt-light-root'}>
                {this.getMainElement()}
            </div>
        </>;
    }

    private getMainElement(): React.JSX.Element {
        if (!this.state.ttConfig) {
            return <>Initializing...</>;
        } else if (this.state.screen === TopScreen.flight_recording) {
            return <FlightRecordingScreen
                darkMode={this.state.darkMode}
                events={this.state.flightEvents}
                close={() => this.setState({screen: TopScreen.connect})}
            />;
        } else if (this.state.screen === TopScreen.control) {
            return <MainScreen
                ttConfig={this.state.ttConfig}
                returnToConnect={() => {
                    processIPC.send(IPC_CONSTANTS_TO_MAIN.clearCoils, undefined);
                    this.setState({screen: TopScreen.connect, coils: []});
                }}
                darkMode={this.state.darkMode}
                coils={this.state.coils}
            />;
        } else if (this.state.screen === TopScreen.connect) {
            return <ConnectScreen
                ttConfig={this.state.ttConfig}
                connecting={false/*TODO*/}
                darkMode={this.state.darkMode}
                setDarkMode={newVal => processIPC.send(IPC_CONSTANTS_TO_MAIN.setDarkMode, newVal)}
                openFlightRecording={(data) => this.setState({
                    flightEvents: data,
                    screen: TopScreen.flight_recording,
                })}
            />;
        } else {
            return <>Unsupported status {this.state.screen} :(</>;
        }
    }
}

export function init() {
    document.addEventListener('DOMContentLoaded', () => {
        const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
        root.render(<React.StrictMode><App/></React.StrictMode>);
    });
}
