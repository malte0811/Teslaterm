// TODO better type?
export function downloadJSON(data: any, fileName: string) {
    const dummyElement = document.createElement('a');
    document.body.appendChild(dummyElement);
    dummyElement.download = fileName;
    dummyElement.href = "data:application/json," + encodeURIComponent(JSON.stringify(data, null, 4));
    dummyElement.click();
    document.body.removeChild(dummyElement);
}

interface UploadedFile {
    content: string;
    fileName: string;
}

export function uploadFile(extensions: string[]): Promise<UploadedFile> {
    const input = document.createElement('input');
    return new Promise((resolveRaw, rejectRaw) => {
        const reject = () => {
            rejectRaw();
        };
        const resolve = (file: UploadedFile) => {
            resolveRaw(file);
        };
        input.type = 'file';
        input.accept = extensions.reduce((a, b) => a + ',' + b);
        input.addEventListener('change', () => {
            const reader = new FileReader();
            reader.readAsText(input.files[0]);
            reader.addEventListener('abort', reject);
            reader.addEventListener('error', reject);
            reader.addEventListener('load', (readerEvent) => {
                resolve({content: readerEvent.target.result as string, fileName: input.files[0].name});
            });
        });
        input.addEventListener('cancel', reject);
        input.click();
    });
}
