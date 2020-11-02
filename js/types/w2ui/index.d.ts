declare const w2utils: W2UI.W2Utils;
declare namespace W2UI {
    export interface W2Utils {
        lang(notification: string);
    }

    export interface W2MenuItem {
        text: string;
        icon: string;
        id: string;
    }

    export interface W2Menu {
        items: W2MenuItem[];
    }

    export interface ChangeEvent {
        target: string;
        value_new: { id: string, text: string };
        value_old: { id: string, text: string } | "";
    }

    export interface W2Field {
        data(type: string, options: Object): W2Field;
    }

    export interface W2FieldData {
        html?: any;
        name: string;
        type: string;
        autoFormat?: boolean;
        items?: Suggestion[];
    }

    export interface Suggestion {
        id: number;
        text: string;
    }
}

interface JQuery {
    w2render(to_render: string): void;

    w2field(type: string, options: Object): W2UI.W2Field;
}

declare interface ConfirmationHandler {
    yes(handler: () => void): ConfirmationHandler;

    no(handler: () => void): ConfirmationHandler;
}

declare function w2confirm(text: string, title?: string): ConfirmationHandler;
