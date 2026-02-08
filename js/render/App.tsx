import React, {useEffect, useState} from "react";
import ReactDOM from "react-dom/client";
import {CoilID} from "../common/constants";
import {IPC_CONSTANTS_TO_MAIN} from "../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER} from "../common/IPCConstantsToRenderer";
import {TTConfig} from "../common/TTConfig";
import {SyncedUIConfig} from "../common/UIConfig";
import {ConnectScreen} from "./connect/ConnectScreen";
import {MainScreen} from "./control/MainScreen";
import {DarkModeContext, UIConfigContext} from "./Contexts";
import {FlightRecordingScreen} from "./flightrecord/FlightRecordingScreen";
import {processIPC} from "./ipc/IPCProvider";
import {useIPCListener} from "./TTComponent";
import {StandaloneVMSEditor} from "./vms/StandaloneVMSEditor";

export enum TopScreen {
    connect,
    control,
    flight_recording,
    vms_edit,
}

export type ExtraScreen = TopScreen.flight_recording | TopScreen.vms_edit;

export function App() {
    const [screen, setScreen] = useState(TopScreen.connect);
    const [ttConfig, setTtConfig] = useState<TTConfig>(undefined);
    const [uiConfig, setUiConfig] = useState<SyncedUIConfig>(undefined);
    const [coils, setCoils] = useState<CoilID[]>([]);
    const [multicoil, setMulticoil] = useState(false);
    useIPCListener(IPC_CONSTANTS_TO_RENDERER.ttConfig, setTtConfig);
    useIPCListener(
        IPC_CONSTANTS_TO_RENDERER.uiConfig, (cfg) => {
            setUiConfig(cfg);
            document.documentElement.setAttribute('data-bs-theme', cfg.darkMode ? 'dark' : 'light');
        },
    );
    useIPCListener(IPC_CONSTANTS_TO_RENDERER.registerCoil, ([coil, multicoil]) => {
        setMulticoil(multicoil);
        setCoils((oldCoils) => {
            if (!coils.includes(coil)) {
                return [...oldCoils, coil]
            } else {
                return oldCoils;
            }
        });
        setScreen(TopScreen.control);
    });
    useEffect(() => processIPC.send(IPC_CONSTANTS_TO_MAIN.requestFullSync, undefined), []);
    const mainElement = (() => {
        if (!ttConfig || !uiConfig) {
            return <>Initializing...</>;
        }
        switch (screen) {
            case TopScreen.connect:
                return <ConnectScreen
                    config={uiConfig}
                    connecting={false/*TODO*/}
                    setDarkMode={newVal => processIPC.send(IPC_CONSTANTS_TO_MAIN.setUIConfig, {darkMode: newVal})}
                    openExtraScreen={setScreen}
                />;
            case TopScreen.control:
                return <MainScreen
                    ttConfig={ttConfig}
                    returnToConnect={() => {
                        processIPC.send(IPC_CONSTANTS_TO_MAIN.clearCoils, undefined);
                        setScreen(TopScreen.connect);
                        setCoils([]);
                    }}
                    config={uiConfig}
                    coils={coils}
                    multicoil={multicoil}
                />;
            case TopScreen.flight_recording:
                return <FlightRecordingScreen close={() => setScreen(TopScreen.connect)}/>;
            case TopScreen.vms_edit:
                return <StandaloneVMSEditor exit={() => setScreen(TopScreen.connect)}/>;
        }
        screen satisfies never;
    })();
    return <div className={'tt-root'}>
        <DarkModeContext.Provider value={uiConfig && uiConfig.darkMode}>
            <UIConfigContext.Provider value={uiConfig}>
                {mainElement}
            </UIConfigContext.Provider>
        </DarkModeContext.Provider>
    </div>;
}

export function init() {
    document.addEventListener('DOMContentLoaded', () => {
        const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
        root.render(<React.StrictMode><App/></React.StrictMode>);
    });
}
