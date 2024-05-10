import React from "react";
import ReactDOM from "react-dom/client";
import {CoilID} from "../common/constants";
import {IPC_CONSTANTS_TO_MAIN} from "../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER} from "../common/IPCConstantsToRenderer";
import {TTConfig} from "../common/TTConfig";
import {UIConfig} from "../common/UIConfig";
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
    config: UIConfig;
    coils: CoilID[];
    multicoil: boolean;
}

export class App extends TTComponent<{}, TopLevelState> {
    constructor(props: any) {
        super(props);
        this.state = {
            coils: [],
            config: undefined,
            multicoil: false,
            screen: TopScreen.connect,
            ttConfig: undefined,
        };
    }

    public componentDidMount() {
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.ttConfig, (cfg) => this.setState({ttConfig: cfg}),
        );
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.uiConfig, (cfg) => this.setState({config: cfg}),
        );
        this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.registerCoil, ([coil, multicoil]) => {
            this.setState((oldState) => {
                const result = {
                    coils: [...oldState.coils],
                    multicoil,
                    screen: oldState.screen,
                };
                if (!oldState.coils.includes(coil)) {
                    result.coils.push(coil);
                    result.screen = TopScreen.control;
                }
                return result;
            });
        });
        processIPC.send(IPC_CONSTANTS_TO_MAIN.requestFullSync, undefined);
    }

    public render(): React.ReactNode {
        const darkMode = this.state.config && this.state.config.darkMode;
        return <>
            <div className={darkMode ? 'tt-dark-root' : 'tt-light-root'}>
                {this.getMainElement()}
            </div>
        </>;
    }

    private getMainElement(): React.JSX.Element {
        if (!this.state.ttConfig || !this.state.config) {
            return <>Initializing...</>;
        } else if (this.state.screen === TopScreen.flight_recording) {
            return <FlightRecordingScreen
                darkMode={this.state.config.darkMode}
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
                config={this.state.config}
                coils={this.state.coils}
                multicoil={this.state.multicoil}
            />;
        } else if (this.state.screen === TopScreen.connect) {
            return <ConnectScreen
                config={this.state.config}
                connecting={false/*TODO*/}
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
