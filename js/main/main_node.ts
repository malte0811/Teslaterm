import * as fs from "fs";
import {createServer, IncomingMessage, ServerResponse} from "http";
import * as path from "path";
import {Server, Socket} from "socket.io";
import * as url from "url";
import {init} from "./init";
import {ISingleWindowIPC, processIPC} from "./ipc/IPCProvider";

class IPC implements ISingleWindowIPC {
    private readonly socket: Socket;

    constructor(socket: Socket) {
        this.socket = socket;
    }

    public on(channel: string, callback: (...args: any[]) => void) {
        this.socket.on(channel, callback);
    }

    public once(channel: string, callback: (...args: any[]) => void) {
        this.socket.once(channel, callback);
    }

    public send(channel: string, ...args: any[]) {
        this.socket.emit(channel, ...args);
    }
}

init();

const app = createServer(httpHandler);
const io = new Server(app);
// TODO config
app.listen(2525);

io.sockets.on('connection', (socket: Socket) => {
    console.log("New websocket connection from " + socket.id);
    processIPC.addWindow(socket, new IPC(socket));
    socket.on("disconnect", (reason) => {
        processIPC.removeWindow(socket);
    });
});

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.ini': 'text/plain',
    '.js': 'text/javascript',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    '.eot': 'appliaction/vnd.ms-fontobject',
    '.ttf': 'aplication/font-sfnt',
    '.map': 'application/octet-stream',
};

function httpHandler(request: IncomingMessage, res: ServerResponse) {
    let pathName = url.parse(request.url).path;
    if (pathName === '/') {
        pathName = '/index_node.html';
    }
    pathName = pathName.substring(1, pathName.length);
    let extName = path.extname(pathName);
    //TODO only give access to the correct files
    let staticFiles = path.join(__dirname, `../../${pathName}`);

    if (extName === '.jpg' || extName === '.png' || extName === '.ico' || extName === '.eot' || extName === '.ttf' || extName === '.svg') {
        if (fs.existsSync(staticFiles)) {
            let file = fs.readFileSync(staticFiles);
            res.writeHead(200, {'Content-Type': mimeTypes[extName]});
            res.write(file, 'binary');
        } else {
            console.log('HTTP: File not Found: ', staticFiles);
            res.writeHead(404, {'Content-Type': 'text/html;charset=utf8'});
            res.write(`<strong>${staticFiles}</strong>: File is not found.`);
        }
        res.end();
    } else {
        fs.readFile(staticFiles, 'utf8', function(err, data) {
            if (!err) {
                res.writeHead(200, {'Content-Type': mimeTypes[extName]});
                res.end(data);
            } else {
                res.writeHead(404, {'Content-Type': 'text/html;charset=utf8'});
                console.log('HTTP: File not Found: ', staticFiles);
                console.log(err);
                res.write(`<strong>${staticFiles}</strong>: File is not found.`);
            }
            res.end();
        });
    }
}
