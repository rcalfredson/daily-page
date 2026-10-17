import { IncomingMessage, ServerResponse } from 'node:http';
import { Duplex } from 'node:stream';

// Exercise Express and its real renderer without opening a listening socket.
export function inject(app, url, { headers = {}, method = 'GET' } = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const socket = new Duplex({
      read() {},
      write(chunk, encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); }
    });
    const req = new IncomingMessage(socket);
    Object.assign(req, {
      method, url, headers: { host: 'dailypage.org', accept: 'text/html', ...headers },
      httpVersion: '1.0', httpVersionMajor: 1, httpVersionMinor: 0
    });
    const res = new ServerResponse(req);
    res.assignSocket(socket);
    res.on('error', reject);
    res.on('finish', () => {
      const raw = Buffer.concat(chunks).toString();
      resolve({ status: res.statusCode, headers: res.getHeaders(), body: raw.slice(raw.indexOf('\r\n\r\n') + 4) });
      socket.destroy();
    });
    app.handle(req, res);
  });
}
