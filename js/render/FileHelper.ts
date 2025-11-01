// TODO better type?
export function downloadJSON(data: any, fileName: string) {
    const dummyElement = document.createElement('a');
    document.body.appendChild(dummyElement);
    dummyElement.download = fileName;
    dummyElement.href = "data:application/json," + encodeURIComponent(JSON.stringify(data, null, 4));
    dummyElement.click();
    document.body.removeChild(dummyElement);
}

interface UploadedFile<T> {
    content: T;
    fileName: string;
}

function uploadFileInternal<T>(
    extensions: string[], startRead: (reader: FileReader, file: File) => void,
): Promise<UploadedFile<T>> {
    const input = document.createElement('input');
    return new Promise((resolve, reject) => {
        input.type = 'file';
        input.accept = extensions.reduce((a, b) => a + ',' + b);
        input.addEventListener('change', () => {
            const reader = new FileReader();
            startRead(reader, input.files[0]);
            reader.addEventListener('abort', reject);
            reader.addEventListener('error', reject);
            reader.addEventListener('load', (readerEvent) => {
                resolve({content: readerEvent.target.result as T, fileName: input.files[0].name});
            });
        });
        input.addEventListener('cancel', reject);
        input.click();
    });
}

export function uploadFile(extensions: string[]): Promise<UploadedFile<string>> {
    return uploadFileInternal<string>(extensions, (r, f) => r.readAsText(f));
}

export function uploadFileRaw(extensions: string[]): Promise<UploadedFile<ArrayBuffer>> {
    return uploadFileInternal<ArrayBuffer>(extensions, (r, f) => r.readAsArrayBuffer(f));
}
