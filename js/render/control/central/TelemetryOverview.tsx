import React from "react";
import {Button} from "react-bootstrap";
import {IPC_CONSTANTS_TO_MAIN} from "../../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER} from "../../../common/IPCConstantsToRenderer";
import {processIPC} from "../../ipc/IPCProvider";
import {TTComponent} from "../../TTComponent";
import {Gauge} from "../gauges/Gauge";
import {CoilState} from "../MainScreen";
import {TelemetrySelector} from "./TelemetrySelector";

export interface CentralTelemetryProps {
    coils: CoilState[];
    darkMode: boolean;
}

interface GaugeData {
    max: number;
    min: number;
    value: number;
}

interface Row {
    name: string;
    values: GaugeData[];
}

interface CentralTelemetryState {
    rows: Row[];
    showingSelector: boolean;
    allAvailableTelemetry: string[];
}

export class TelemetryOverview extends TTComponent<CentralTelemetryProps, CentralTelemetryState> {
    constructor(props: CentralTelemetryProps) {
        super(props);
        this.state = {
            allAvailableTelemetry: [],
            rows: [],
            showingSelector: false,
        };
    }

    public componentDidMount() {
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.centralTab.setCentralTelemetry,
            ([coil, values]) => this.setState((oldState) => {
                const newRows: Row[] = [];
                const coilColumn = this.props.coils.findIndex(c => c?.id === coil);
                // TODO
                if (coilColumn < 0) {
                    return;
                }
                values.forEach((value, i) => {
                    const values: GaugeData[] = [...(oldState.rows[i]?.values || [])];
                    while (values.length < this.props.coils.length) {
                        values.push(undefined);
                    }
                    if (value) {
                        values[coilColumn] = {max: value.max, min: value.min, value: value.value};
                    } else {
                        values[coilColumn] = undefined;
                    }
                    newRows.push({name: value?.valueName || oldState.rows[i]?.name || "Invalid", values});
                });
                return {rows: newRows};
            }),
        );
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.centralTab.informTelemetryNames,
            (names) => this.setState((oldState) => {
                const allNames = [...oldState.allAvailableTelemetry];
                for (const name of names) {
                    if (!allNames.includes(name)) {
                        allNames.push(name);
                    }
                }
                return {allAvailableTelemetry: allNames};
            }),
        );
        this.requestSync();
    }

    public render() {
        const inRowOrder: React.JSX.Element[] = [];
        for (const row of this.state.rows) {
            inRowOrder.push(<div className={'tt-vertical-gauge-label'}>{row.name}</div>);
            inRowOrder.push(...this.props.coils.map((coil, i) => {
                const value = row.values[i];
                if (value) {
                    return <Gauge
                        value={value.value}
                        config={{
                            max: value.max,
                            meterId: 0,
                            min: value.min,
                            name: "",
                            scale: 1,
                        }}
                        darkMode={this.props.darkMode}
                    />;
                } else {
                    return <div/>;
                }
            }));
        }
        inRowOrder.push(<div/>);
        for (const coil of this.props.coils) {
            inRowOrder.push(<div style={{textAlign: 'center'}}>{coil?.name || "Unknown"}</div>);
        }
        const columnSpec = `min-content repeat(${this.props.coils.length}, 120px)`;
        const rowSpec = `repeat(${this.state.rows.length}, min-content)`;
        return (
            <div className={'tt-telemetry-overview'}>
                <div className={'tt-telemetry-overview-meters'} style={{
                    gridTemplateColumns: columnSpec,
                    gridTemplateRows: rowSpec,
                    // TODO
                    width: 'min-content',
                }}>
                    {...inRowOrder}
                </div>
                <Button
                    style={{verticalAlign: 'bottom'}}
                    onClick={() => this.openSelector()}
                >Configure</Button>
                <TelemetrySelector
                    availableNames={this.state.allAvailableTelemetry}
                    close={() => this.closeSelector()}
                    shown={this.state.showingSelector}
                    darkMode={this.props.darkMode}
                />
            </div>
        );
    }

    private openSelector() {
        this.setState(
            {
                allAvailableTelemetry: [],
                showingSelector: true,
            },
            () => processIPC.send(IPC_CONSTANTS_TO_MAIN.centralTab.requestTelemetryNames, undefined),
        );
    }

    private closeSelector() {
        this.setState({showingSelector: false});
        this.requestSync();
    }

    private requestSync() {
        this.setState(
            {rows: []},
            () => processIPC.send(IPC_CONSTANTS_TO_MAIN.centralTab.requestCentralTelemetrySync, undefined),
        );
    }
}
