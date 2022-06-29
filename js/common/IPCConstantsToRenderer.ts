import {MediaFileType, PlayerActivity} from "./CommonTypes";
import {maxOntime} from "./constants";
import {CommandRole} from "./TTConfig";

export const IPC_CONSTANTS_TO_RENDERER = {
    menu: {
        connectionButtonText: "menu-connection-text",
        setMediaTitle: "menu-media-title",
        setScriptName: "menu-script-name",
        ud3State: "menu-ud3-state",
    },
    meters: {
        configure: "meter-config",
        setValue: "meter-set-value",
    },
    openConnectionUI: "connection-ui",
    scope: {
        addValues: "scope-values",
        configure: "scope-config",
        drawLine: "scope-draw-line",
        drawString: "scope-draw-string",
        redrawMedia: "scope-draw-media",
        startControlled: "scope-start-controlled",
    },
    script: {
        requestConfirm: "script-request-confirm",
    },
    sliders: {
        syncSettings: "slider-sync",
    },
    terminal: "terminal",
    ttConfig: "tt-config",
    udConfig: "ud-config",
};

export class SetMeters {
    public readonly values: { [id: number]: number };

    constructor(values: { [id: number]: number }) {
        this.values = values;
    }
}

export class MeterConfig {
    public readonly meterId: number;
    public readonly min: number;
    public readonly max: number;
    public readonly scale: number;
    public readonly name: string;

    constructor(meterId: number, min: number, max: number, scale: number, name: string) {
        this.meterId = meterId;
        this.min = min;
        this.max = max;
        this.scale = scale;
        this.name = name;
    }
}

export class UD3State {
    public static DEFAULT_STATE = new UD3State(false, false, false, false);

    public readonly busActive: boolean;
    public readonly busControllable: boolean;
    public readonly transientActive: boolean;
    public readonly killBitSet: boolean;

    constructor(active: boolean, controllable: boolean, transientActive: boolean, killBitSet: boolean) {
        this.busActive = active;
        this.busControllable = controllable;
        this.transientActive = transientActive;
        this.killBitSet = killBitSet;
    }

    public equals(other: UD3State): boolean {
        return this.busActive === other.busActive &&
            this.busControllable === other.busControllable &&
            this.transientActive === other.transientActive &&
            this.killBitSet === other.killBitSet;
    }
}

export class ScopeTraceConfig {
    public readonly id: number;
    public readonly min: number;
    public readonly max: number;
    public readonly offset: number;
    public readonly div: number;
    public readonly unit: string;
    public readonly name: string;

    constructor(id: number, min: number, max: number, offset: number, div: number, unit: string, name: string) {
        this.id = id;
        this.min = min;
        this.max = max;
        this.offset = offset;
        this.div = div;
        this.unit = unit;
        this.name = name;
    }
}

export class ScopeValues {
    public readonly values: Array<{ [key: number]: number }>;

    constructor(values: Array<{ [key: number]: number }>) {
        this.values = values;
    }
}

export class ScopeLine {
    public readonly x1: number;
    public readonly y1: number;
    public readonly x2: number;
    public readonly y2: number;
    public readonly color: number;

    constructor(x1: number, y1: number, x2: number, y2: number, color: number) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.color = color;
    }
}

export class ScopeText {
    public readonly x: number;
    public readonly y: number;
    public readonly color: number;
    public readonly size: number;
    public readonly str: string;
    public readonly center: boolean;


    constructor(x: number, y: number, color: number, size: number, str: string, center: boolean) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = size;
        this.str = str;
        this.center = center;
    }
}

export class MediaState {
    public readonly progress: number;
    public readonly state: PlayerActivity;
    public readonly title: string;
    public readonly type: MediaFileType;

    constructor(progress: number, state: PlayerActivity, title: string, type: MediaFileType) {
        this.progress = progress;
        this.state = state;
        this.title = title;
        this.type = type;
    }
}

export class ConfirmationRequest {
    public readonly confirmationID: number;
    public readonly message: string;
    public readonly title: string | undefined;

    constructor(id: number, message: string, title?: string) {
        this.confirmationID = id;
        this.message = message;
        this.title = title;
    }
}

export class SliderState {
    public ontimeAbs: number;
    public ontimeRel: number;
    public bps: number = 20;
    public burstOntime: number = 0;
    public burstOfftime: number = 500;
    public relativeAllowed: boolean = true;

    constructor(role: CommandRole) {
        this.ontimeAbs = role !== "disable" ? maxOntime : 0;
        this.ontimeRel = role !== "disable" ? 0 : 100;
        this.relativeAllowed = role !== "client";
    }

    public get ontime() {
        return this.ontimeAbs * this.ontimeRel / 100;
    }
}
