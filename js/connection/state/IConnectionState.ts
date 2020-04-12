import {IUD3Connection} from "../IUD3Connection";

export interface IConnectionState {
    getButtonText(): string;

    getButtonTooltip(): string;

    pressButton(text: string): IConnectionState;

    getActiveConnection(): IUD3Connection | undefined;

    tick(): IConnectionState;
}
