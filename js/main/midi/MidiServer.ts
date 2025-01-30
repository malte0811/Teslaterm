import {manager, Session} from "rtpmidi";
import {PlayerActivity} from "../../common/MediaTypes";
import {MidiConfig} from "../../common/Options";
import {media_state} from "../media/media_player";
import {playMidiData} from "./MidiComms";

export class MidiServer {
    private readonly session: Session;

    constructor(config: MidiConfig) {
        this.session = manager.createSession({
            bonjourName: config.bonjourName,
            localName: config.localName,
            port: config.port,
        });
        this.session.on("message", async (delta, data) => {
            if (media_state.state === PlayerActivity.playing) {
                media_state.stopPlaying();
            }
            await playMidiData(data);
        });
    }

    public close() {
        this.session.end();
    }
}
