import {SliderState, UD3State} from "../../common/IPCConstantsToRenderer";
import {SlidersIPC} from "../ipc/sliders";
import {terminal} from "./constants";

export class OntimeUI {

    private readonly slider: HTMLInputElement;
    private relativeSelect: HTMLInputElement;
    private total: HTMLSpanElement;
    private relative: HTMLSpanElement;
    private absolute: HTMLSpanElement;

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
        state.relativeAllowed = allow;
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
        time = Math.min(state.maxOntime, Math.max(0, time));
        state.ontimeAbs = time;
        this.absolute.textContent = state.ontimeAbs.toFixed();
        this.updateOntimeLabels();
        if (manual) {
            SlidersIPC.setAbsoluteOntime(state.ontimeAbs);
        }
    }

    public setRelativeOntime(percentage: number, manual: boolean) {
        if (this.relativeSelect.checked) {
            setSliderValue(null, percentage, this.slider);
        }
        percentage = Math.min(100, Math.max(0, percentage));
        state.ontimeRel = percentage;
        this.relative.textContent = state.ontimeRel.toFixed();
        this.updateOntimeLabels();
        if (manual) {
            SlidersIPC.setRelativeOntime(state.ontimeRel);
        }
    }

    public updateOntimeLabels() {
        if (this.relativeSelect.checked) {
            this.relative.innerHTML = "<b>" + state.ontimeRel + "</b>";
            this.absolute.innerHTML = state.ontimeAbs.toFixed();
        } else {
            this.absolute.innerHTML = "<b>" + state.ontimeAbs + "</b>";
            this.relative.innerHTML = state.ontimeRel.toFixed();
        }
        this.total.innerHTML = state.ontime.toFixed();
    }

    public onRelativeOntimeSelect() {
        if (this.relativeSelect.checked) {
            this.slider.max = "100";
            this.slider.value = state.ontimeRel.toFixed();
        } else {
            this.slider.max = state.maxOntime.toFixed();
            this.slider.value = state.ontimeAbs.toFixed();
        }
        this.updateOntimeLabels();
    }

    public onSliderMoved() {
        const newValue = parseInt(this.slider.value, 10);
        if (this.relativeSelect.checked) {
            this.setRelativeOntime(newValue, true);
        } else {
            this.setAbsoluteOntime(newValue, true);
        }
    }

    public markEnabled(enabled: boolean) {
        this.slider.className = enabled ? "slider" : "slider-gray";
    }

    public setAbsoluteMaximum(maxOntime: number) {
        if (!this.relativeSelect.checked) {
            this.slider.max = maxOntime.toFixed();
            this.updateOntimeLabels();
        }
        state.maxOntime = maxOntime;
    }
}

export let ontime: OntimeUI;
const state: SliderState = new SliderState("disable");
const bpsName = "slider1";
const burstOntimeName = "slider2";
const burstOfftimeName = "slider3";

export function updateSliderState(newState: SliderState) {
    ontime.setAbsoluteMaximum(newState.maxOntime);
    ($("#" + bpsName)[0] as HTMLInputElement).max = newState.maxBPS.toFixed();
    ontime.setAbsoluteOntime(newState.ontimeAbs, false);
    ontime.setRelativeOntime(newState.ontimeRel, false);
    ontime.setRelativeAllowed(newState.relativeAllowed);
    bpsSlider(newState.bps);
    burstOntimeSlider(newState.burstOntime);
    burstOfftimeSlider(newState.burstOfftime);
    state.maxBPS = newState.maxBPS;
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
        terminal.writeln("Tried to set slider \"" + slider.id + "\" out of range (To " + value + ")!");
        value = Math.min(slider.max, Math.max(slider.min, value));
    }
    slider.value = value;
}

function bpsSlider(value?: number) {
    const slider = document.getElementById(bpsName) as HTMLInputElement;
    const slider_disp = document.getElementById("slider1_disp");
    if (value !== undefined) {
        setSliderValue("", value, slider);
    } else {
        SlidersIPC.setBPS(Number(slider.value));
    }
    slider_disp.innerHTML = slider.value + " Hz";
}

function burstOntimeSlider(value?: number) {
    const slider: HTMLInputElement = document.getElementById(burstOntimeName) as HTMLInputElement;
    const slider_disp = document.getElementById("slider2_disp");
    if (value !== undefined) {
        setSliderValue("", value, slider);
    } else {
        SlidersIPC.setBurstOntime(Number(slider.value));
    }
    slider_disp.innerHTML = slider.value + " ms";
}

function burstOfftimeSlider(value?: number) {
    const slider = document.getElementById(burstOfftimeName) as HTMLInputElement;
    const slider_disp = document.getElementById("slider3_disp");
    if (value !== undefined) {
        setSliderValue("", value, slider);
    } else {
        SlidersIPC.setBurstOfftime(Number(slider.value));
    }
    slider_disp.innerHTML = slider.value + " ms";
}
