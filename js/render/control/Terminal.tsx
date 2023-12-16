import React from "react";
import * as xterm from "xterm";
import {CoilID} from "../../common/constants";
import {getToRenderIPCPerCoil} from "../../common/IPCConstantsToRenderer";
import {commands} from "../ipc/commands";
import {TTComponent} from "../TTComponent";
import {TerminalRef} from "./MainScreen";

export interface TerminalProps {
    terminal: TerminalRef;
    disabled: boolean;
    coil: CoilID;
}

export class Terminal extends TTComponent<TerminalProps, {}> {
    private readonly terminalDivRef: React.RefObject<HTMLDivElement>;

    constructor(props: any) {
        super(props);
        this.terminalDivRef = React.createRef();
    }

    public componentDidMount() {
        if (this.terminalDivRef.current && !this.props.terminal.terminal) {
            this.props.terminal.terminal = new xterm.Terminal();
            const terminal = new xterm.Terminal();
            terminal.loadAddon(this.props.terminal.fitter);
            terminal.resize(0, 0);
            terminal.onKey((ev) => {
                if (!this.props.disabled) {
                    commands(this.props.coil).sendManualCommand(ev.key);
                }
            });
            terminal.open(this.terminalDivRef.current);
            this.props.terminal.terminal = terminal;
            this.addIPCListener(getToRenderIPCPerCoil(this.props.coil).terminal, s => this.onDataFromMain(s));
            this.fitManually();
            commands(this.props.coil).sendManualCommand('\rcls\r');
            new ResizeObserver(() => this.fitManually()).observe(this.terminalDivRef.current);
        }
    }

    public componentWillUnmount() {
        super.componentWillUnmount();
        if (this.props.terminal.terminal) {
            this.props.terminal.terminal.dispose();
            this.props.terminal.terminal = undefined;
        }
    }

    public render(): React.ReactNode {
        return <div ref={this.terminalDivRef} className={'tt-terminal'}/>;
    }

    private onDataFromMain(s: string) {
        if (this.props.terminal.terminal) {
            this.props.terminal.terminal.write(s);
        }
    }

    private fitManually() {
        // Hack: The layout rules don't seem to be enough to make the fitter only take the height it has if the terminal
        // already exceeds that, so shrink the terminal vertically and then let the fitter expand it again
        if (this.props.terminal.terminal) {
            this.props.terminal.terminal.resize(this.props.terminal.terminal.cols, 1);
            this.props.terminal.fitter.fit();
        }
    }
}
