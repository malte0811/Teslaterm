export class Meter {
    private meter_buf_old: number;
    private meter_buf: number;
    private scale: number = 1;
    private gauge: JustGage;

    constructor(id: number) {
        this.meter_buf_old = 255;
        this.meter_buf = 0;
        this.gauge = new JustGage({
            id: ("gauge" + id),
            value: 0,
            // tslint:disable-next-line:object-literal-sort-keys
            min: 0,
            max: 255,
            decimals: 1,
            title: ("Gauge" + id),
        });
    }

    public refresh(): void {
        if (this.meter_buf !== this.meter_buf_old) {
            this.gauge.refresh(this.meter_buf);
            this.meter_buf_old = this.meter_buf;
        }
    }

    public setValue(value: number): void {
        this.meter_buf = value / this.scale;
    }

    public setText(new_text: string): void {
        this.gauge.txtLabel.attr({text: new_text});
    }

    public setRange(min: number, max: number, scale: number) {
        // Why????
        if (scale === 0) {
            scale = 1;
        }
        this.scale = scale;
        this.gauge.refresh(min, max);
    }
}

export const NUM_GAUGES = 7;


export let meters: Meter[] = [];

export function init(): void {
    for (let i = 0; i < NUM_GAUGES; ++i) {
        meters[i] = new Meter(i);
    }
}

export function refresh_all(): void {
    for (const meter of meters) {
        meter.refresh();
    }
}
