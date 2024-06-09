import JSZip from "jszip";
import {SongListData} from "../../../common/IPCConstantsToRenderer";
import {loadMediaFile} from "../media_player";

interface SongData {
    name: string;
    data: Buffer;
}

export class Playlist {
    public static async load(files: JSZip) {
        const songPromises: Array<Promise<SongData>> = [];
        files.forEach((name, file) => {
            songPromises.push(
                file.async('nodebuffer').then((buffer) => ({name, data: buffer})),
            );
        });
        const playlist = new Playlist(await Promise.all(songPromises));
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
        this.currentSong = (nonWrapped + this.songs.length) % this.songs.length;
        await this.loadSelectedFile();
    }

    public getSyncState(): SongListData {
        return {
            current: this.currentSong,
            songs: this.songs.map((song) => song.name),
        };
    }

    private async loadSelectedFile() {
        const song = this.songs[this.currentSong];
        await loadMediaFile({contents: song.data, name: song.name});
    }
}
