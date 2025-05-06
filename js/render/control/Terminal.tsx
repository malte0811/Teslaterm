import {FitAddon} from "@xterm/addon-fit";
import * as xterm from "@xterm/xterm";
import React from "react";
import {CoilID} from "../../common/constants";
import {getToRenderIPCPerCoil} from "../../common/IPCConstantsToRenderer";
import {commands} from "../ipc/commands";
import {IPCListenerRef, processIPC} from "../ipc/IPCProvider";
import {TTComponent} from "../TTComponent";

export interface TerminalProps {
    disabled: boolean;
    coil: CoilID;
}

class CoilPrinterAddon implements xterm.ITerminalAddon {
    private readonly coil: CoilID;
    private listener: IPCListenerRef;

    public constructor(coil: CoilID) {
        this.coil = coil;
    }

    public activate(terminal: xterm.Terminal) {
        if (this.listener) {
            this.dispose();
        }
        this.listener = processIPC.on(getToRenderIPCPerCoil(this.coil).terminal, (s) => terminal.write(s));
    }

    public dispose() {
        processIPC.removeListener(this.listener);
        this.listener = undefined;
    }
}

export class Terminal extends TTComponent<TerminalProps, {}> {
    private readonly terminalDivRef: React.RefObject<HTMLDivElement>;
    private readonly fitter: FitAddon;
    private terminal?: xterm.Terminal;

    constructor(props: any) {
        super(props);
        this.terminalDivRef = React.createRef();
        this.fitter = new FitAddon();
    }

    public render(): React.ReactNode {
        return <div
            className={'tt-terminal'}
            ref={this.terminalDivRef}
        />;
    }

    public componentDidMount() {
        if (this.terminalDivRef.current) {
            this.terminal = this.setupTerminal();
            this.terminal.open(this.terminalDivRef.current);
            this.fitManually();
            commands(this.props.coil).sendManualCommand('\rcls\r');
            new ResizeObserver(() => this.fitManually()).observe(this.terminalDivRef.current);
        }
    }

    public componentWillUnmount() {
        super.componentWillUnmount();
        this.terminal.dispose();
        this.terminal = undefined;
    }

    private setupTerminal() {
        const terminal = new xterm.Terminal();
        terminal.loadAddon(this.fitter);
        terminal.loadAddon(new CoilPrinterAddon(this.props.coil));

        // Create Listeners
        terminal.onKey((ev) => {
            if (!this.props.disabled) {
                commands(this.props.coil).sendManualCommand(ev.key);
            }
        });
        return terminal;
    }

    private fitManually() {
        // Hack: The layout rules don't seem to be enough to make the fitter only take the height it has if the terminal
        // already exceeds that, so shrink the terminal vertically and then let the fitter expand it again
        if (this.terminal) {
            const minColumns = 70;
            this.terminal.resize(minColumns, 1);
            this.fitter.fit();
            // Hack: When the terminal is not visible, we may end up with near-zero dimensions here. But with those the
            // UD3 startup text does not show properly, so make the terminal big enough for that.
            if (this.terminal.cols < minColumns) {
                this.terminal.resize(minColumns, this.terminal.rows);
            }
        }
    }
}
