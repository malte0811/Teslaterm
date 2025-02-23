import {MidiData, MidiEvent} from "midi-file";

class PlayerTrack {
    private readonly events: MidiEvent[];
    private lastEventTick: number;
    private nextEventIndex: number;

    public constructor(events: MidiEvent[]) {
        this.events = events;
        this.lastEventTick = 0;
        this.nextEventIndex = 0;
    }

    public ticksToNextEvent(currentTick: number) {
        if (this.nextEventIndex >= this.events.length) {
            return undefined;
        } else {
            const nextEventTime = this.lastEventTick + this.events[this.nextEventIndex].deltaTime;
            return nextEventTime - currentTick;
        }
    }

    public pollEvent() {
        const event = this.events[this.nextEventIndex];
        ++this.nextEventIndex;
        this.lastEventTick += event.deltaTime;
        return event;
    }

    public getTotalTicks() {
        let tick = 0;
        for (const event of this.events) {
            tick += event.deltaTime;
        }
        return tick;
    }

}

export class MidiPlayer {
    private readonly tracks: PlayerTrack[];
    private readonly playCallback: (ev: MidiEvent) => any;
    private readonly stopCallback: () => any;
    private readonly skipStartSilence: boolean;
    private readonly lengthInTicks: number;
    // Aka "division"
    private readonly ticksPerQuarter: number;
    // Aka "tempo"
    private microsecondsPerQuarter: number;
    private currentWait: NodeJS.Timeout;
    private currentTick: number;
    private foundNoteOn: boolean;
    private nextEventTime: number;

    public constructor(
        data: MidiData, skipStartSilence: boolean, playCallback: (ev: MidiEvent) => any, stopCallback: () => any,
        ) {
        this.tracks = data.tracks.map((track) => new PlayerTrack(track));
        this.playCallback = playCallback;
        this.stopCallback = stopCallback;
        this.skipStartSilence = skipStartSilence;
        this.ticksPerQuarter = data.header.ticksPerBeat || 120;
        this.lengthInTicks = Math.max(...this.tracks.map((track) => track.getTotalTicks()));
        this.microsecondsPerQuarter = 500_000;
        this.currentTick = 0;
        this.foundNoteOn = false;
    }

    public start() {
        this.nextEventTime = Date.now();
        this.runScheduler();
    }

    public stop() {
        if (this.currentWait) {
            clearTimeout(this.currentWait);
            this.currentWait = undefined;
        }
        this.stopCallback();
    }

    public isPlaying() {
        return this.currentWait !== undefined;
    }

    public estimatePlayedFraction() {
        return this.currentTick / this.lengthInTicks;
    }

    private runScheduler() {
        this.currentWait = undefined;
        let ticksToNext: number;
        do {
            ticksToNext = Infinity;
            for (const track of this.tracks) {
                const trackDelay = track.ticksToNextEvent(this.currentTick);
                if (trackDelay <= 0) {
                    this.processEvent(track.pollEvent());
                }
                if (trackDelay < ticksToNext) {
                    ticksToNext = trackDelay;
                }
            }
            this.currentTick += ticksToNext;
        } while (ticksToNext <= 0 || (this.skipStartSilence && !this.foundNoteOn));
        if (ticksToNext < Infinity) {
            this.nextEventTime += ticksToNext * this.millisecondsPerTick();
            this.currentWait = setTimeout(() => this.runScheduler(), this.nextEventTime - Date.now());
        } else {
            this.stopCallback();
        }
    }

    private processEvent(event: MidiEvent) {
        this.foundNoteOn ||= event.type === 'noteOn';
        if (event.type === 'setTempo') {
            this.microsecondsPerQuarter = event.microsecondsPerBeat;
        } else {
            this.playCallback(event);
        }
    }

    private millisecondsPerTick() {
        return (this.microsecondsPerQuarter / 1000) / this.ticksPerQuarter;
    }
}
