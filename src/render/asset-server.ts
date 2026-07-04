import { createServer, Server } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { AddressInfo } from 'node:net';

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json'
};

/**
 * Minimal static file server rooted at a directory, so Remotion compositions can
 * load run assets (video/audio/images) over HTTP without a Remotion public dir.
 * Supports Range requests (required by <OffthreadVideo>/Chromium media).
 */
export class AssetServer {
  private server: Server | null = null;
  private rootAbs: string;
  port = 0;

  constructor(rootDir: string) {
    this.rootAbs = resolve(rootDir);
  }

  async start(): Promise<void> {
    this.server = createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
        const filePath = resolve(this.rootAbs, `.${urlPath}`);
        if (filePath !== this.rootAbs && !filePath.startsWith(this.rootAbs + sep)) {
          res.writeHead(403).end();
          return;
        }
        const info = await stat(filePath);
        const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
        const range = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
        if (range) {
          const start = Number(range[1]);
          const end = range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
          res.writeHead(206, {
            'Content-Type': type,
            'Content-Length': end - start + 1,
            'Content-Range': `bytes ${start}-${end}/${info.size}`,
            'Accept-Ranges': 'bytes'
          });
          createReadStream(filePath, { start, end }).pipe(res);
        } else {
          res.writeHead(200, { 'Content-Type': type, 'Content-Length': info.size, 'Accept-Ranges': 'bytes' });
          createReadStream(filePath).pipe(res);
        }
      } catch {
        res.writeHead(404).end();
      }
    });
    await new Promise<void>((resolvePromise) => {
      this.server!.listen(0, '127.0.0.1', () => {
        this.port = (this.server!.address() as AddressInfo).port;
        resolvePromise();
      });
    });
  }

  /** Turn an absolute (or root-relative) file path into a URL served by this server. */
  urlFor(filePath: string): string {
    const abs = resolve(filePath);
    if (!abs.startsWith(this.rootAbs)) throw new Error(`Asset outside server root: ${filePath}`);
    const rel = abs.slice(this.rootAbs.length).split(sep).join('/');
    return `http://127.0.0.1:${this.port}${rel.startsWith('/') ? rel : `/${rel}`}`;
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((r) => this.server!.close(() => r()));
      this.server = null;
    }
  }
}
