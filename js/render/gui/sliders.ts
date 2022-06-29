import {maxOntime} from "../../common/constants";
import {SliderState, UD3State} from "../../common/IPCConstantsToRenderer";
import {SlidersIPC} from "../ipc/sliders";
import {terminal} from "./constants";

export class OntimeUI {

    private readonly slider: HTMLInputElement;
    private relativeSelect: HTMLInputElement;
    private total: HTMLSpanElement;
    private relative: HTMLSpanElement;
    private absolute: HTMLSpanElement;
    private absoluteVal: number = 0;
    private relativeVal: number = 100;
    private totalVal: number = 0;

    public constructor() {
        this.slider = ($(".w2ui-panel-content .scopeview #ontime #slider")[0] as HTMLInputElement);
        this.relativeSelect = ($(".w2ui-panel-content .scopeview #ontime #relativeSelect")[0] as HTMLInputElement);
        this.total = $(".w2ui-panel-content .scopeview #ontime #total")[0];
        this.relative = $(".w2ui-panel-content .scopeview #ontime #relative")[0];
        this.absolute = $(".w2ui-panel-content .scopeview #ontime #absolute")[0];
        this.slider.addEventListener("input", () => ontime.onSliderMoved());
        this.relativeSelect.onclick = () => ontime.onRelativeOntimeSelect();
    }

    public setRelativeAllowed(allow: boolean) {
        if (allow) {
            this.relativeSelect.disabled = false;
        } else {
            this.relativeSelect.checked = false;
            this.relativeSelect.onclick(new MouseEvent("click"));
            this.relativeSelect.disabled = true;
        }
    }

    public setAbsoluteOntime(time: number, manual: boolean) {
        if (!this.relativeSelect.checked) {
            setSliderValue(null, time, this.slider);
        }
        time = Math.min(maxOntime, Math.max(0, time));
        this.absoluteVal = time;
        this.absolute.textContent = this.absoluteVal.toString();
        this.ontimeChanged();
        if (manual) {
            SlidersIPC.setAbsoluteOntime(this.absoluteVal);
        }
    }

    public setRelativeOntime(percentage: number, manual: boolean) {
        if (this.relativeSelect.checked) {
            setSliderValue(null, percentage, this.slider);
        }
        percentage = Math.min(100, Math.max(0, percentage));
        this.relativeVal = percentage;
        this.relative.textContent = this.relativeVal.toString();
        this.ontimeChanged();
        if (manual) {
            SlidersIPC.setRelativeOntime(this.relativeVal);
        }
    }

    public updateOntimeLabels() {
        if (this.relativeSelect.checked) {
            this.relative.innerHTML = "<b>" + this.relativeVal + "</b>";
            this.absolute.innerHTML = this.absoluteVal.toFixed();
        } else {
            this.absolute.innerHTML = "<b>" + this.absoluteVal + "</b>";
            this.relative.innerHTML = this.relativeVal.toFixed();
        }
        this.total.innerHTML = this.totalVal.toFixed();
    }

    public onRelativeOntimeSelect() {
        if (this.relativeSelect.checked) {
            this.slider.max = "100";
            this.slider.value = this.relativeVal.toFixed();
        } else {
            this.slider.max = maxOntime.toFixed();
            this.slider.value = this.absoluteVal.toFixed();
        }
        this.updateOntimeLabels();
    }

    public onSliderMoved() {
        if (this.relativeSelect.checked) {
            this.setRelativeOntime(parseInt(this.slider.value, 10), true);
        } else {
            this.setAbsoluteOntime(parseInt(this.slider.value, 10), true);
        }
    }

    public ontimeChanged() {
        this.totalVal = Math.round(this.absoluteVal * this.relativeVal / 100.);
        this.updateOntimeLabels();
    }

    public markEnabled(enabled: boolean) {
        ontime.slider.className = enabled ? "slider" : "slider-gray";
    }
}

export let ontime: OntimeUI;
export let state: SliderState = new SliderState("disable");
const bpsName = "slider1";
const burstOntimeName = "slider2";
const burstOfftimeName = "slider3";

export function updateSliderState(newState: SliderState) {
    ontime.setAbsoluteOntime(newState.ontimeAbs, false);
    ontime.setRelativeOntime(newState.ontimeRel, false);
    ontime.setRelativeAllowed(newState.relativeAllowed);
    bpsSlider(newState.bps);
    burstOntimeSlider(newState.burstOntime);
    burstOfftimeSlider(newState.burstOfftime);
}

export function updateSliderAvailability(ud3State: UD3State) {
    const busMaybeActive = ud3State.busActive || !ud3State.busControllable;
    const offDisable = !(ud3State.transientActive && busMaybeActive);
    for (let i = 1; i <= 3; ++i) {
        const slider = $(".w2ui-panel-content .scopeview #slider" + i)[0];
        slider.className = offDisable ? "slider-gray" : "slider";
    }
    ontime.markEnabled(busMaybeActive);
}

export function init() {
    ontime = new OntimeUI();
    $("#" + bpsName)[0].addEventListener("input", () => bpsSlider());
    $("#" + burstOntimeName)[0].addEventListener("input", () => burstOntimeSlider());
    $("#" + burstOfftimeName)[0].addEventListener("input", () => burstOfftimeSlider());
}

function setSliderValue(name: string, value: number, slider?) {
    if (!slider) {
        slider = document.getElementById(name);
    }
    if (value < slider.min || value > slider.max) {
        terminal.io.println("Tried to set slider \"" + slider.id + "\" out of range (To " + value + ")!");
        value = Math.min(slider.max, Math.max(slider.min, value));
    }
    slider.value = value;
}

function bpsSlider(value?: number) {
    const slider = document.getElementById(bpsName) as HTMLInputElement;
    const slider_disp = document.getElementById("slider1_disp");
    if (value) {
        setSliderValue("", value, slider);
    } else {
        SlidersIPC.setBPS(Number(slider.value));
    }
    slider_disp.innerHTML = slider.value + " Hz";
}

function burstOntimeSlider(value?: number) {
    const slider: HTMLInputElement = document.getElementById(burstOntimeName) as HTMLInputElement;
    const slider_disp = document.getElementById("slider2_disp");
    if (value) {
        setSliderValue("", value, slider);
    } else {
        SlidersIPC.setBurstOntime(Number(slider.value));
    }
    slider_disp.innerHTML = slider.value + " ms";
}

function burstOfftimeSlider(value?: number) {
    const slider = document.getElementById(burstOfftimeName) as HTMLInputElement;
    const slider_disp = document.getElementById("slider3_disp");
    if (value) {
        setSliderValue("", value, slider);
    } else {
        SlidersIPC.setBurstOfftime(Number(slider.value));
    }
    slider_disp.innerHTML = slider.value + " ms";
}
