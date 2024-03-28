import * as MidiPlayer from "midi-player-js";
import {VoiceID} from "../../common/IPCConstantsToRenderer";
import {ipcs} from "../ipc/IPCProvider";
import {sendProgramChange} from "./midi";

async function maybeRedirectProgramChange(channel: VoiceID): Promise<boolean> {
    const programOverride = ipcs.mixer.getProgramFor(channel);
    if (programOverride !== undefined) {
        await sendProgramChange(channel, programOverride);
        return true;
    } else {
        return false;
    }
}

export async function maybeRedirectEvent(event: MidiPlayer.Event): Promise<boolean> {
    if (event.name === 'Program Change') {
        return maybeRedirectProgramChange(event.channel);
    } else {
        return false;
    }
}
