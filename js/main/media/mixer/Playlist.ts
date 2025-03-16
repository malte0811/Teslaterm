import {DroppedFile} from "../../../common/IPCConstantsToMain";
import {SongListData} from "../../../common/IPCConstantsToRenderer";
import {loadMediaFile} from "../media_player";

type SongData = DroppedFile;

export class Playlist {
    public static async load(files: DroppedFile[]) {
        const playlist = new Playlist(files);
        await playlist.loadSelectedFile();
        return playlist;
    }

    private readonly songs: SongData[];
    private currentSong: number;

    private constructor(songs: SongData[]) {
        this.songs = songs;
        this.currentSong = 0;
    }

    public async cycle(forward: boolean) {
        const nonWrapped = this.currentSong + (forward ? 1 : -1);
        await this.setIndex((nonWrapped + this.songs.length) % this.songs.length);
    }

    public async setIndex(index: number) {
        this.currentSong = index;
        await this.loadSelectedFile();
    }

    public getSyncState(): SongListData {
        return {
            current: this.currentSong,
            songs: this.songs.map((song) => song.name),
        };
    }

    private async loadSelectedFile() {
        await loadMediaFile(this.songs[this.currentSong]);
    }
}
