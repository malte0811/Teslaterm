declare class GaugeConfig {
    min: number;
    max: number;
    label: string;
    value: number;
}

declare class JustGage {
    constructor(options: any);

    config: GaugeConfig;

    refresh(val: number, max?: number, min?: number, label?: string);
}
