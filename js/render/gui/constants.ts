import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

export const terminal = new Terminal();
export const terminalFitter = new FitAddon();
export const MEAS_SPACE = 20;
export const INFO_SPACE = 150;
export const TOP_SPACE = 20;
export const TRIGGER_SPACE = 10;
export const CONTROL_SPACE = 15;
export const MEAS_POSITION = 4;

export function init() {
    terminal.loadAddon(terminalFitter);
}
