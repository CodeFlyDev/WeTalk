import { Client } from 'ssh2';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const conn = new Client();
const log = (...a) => console.log('[U]', ...a);

const distDir = 'e:/Github/WeTalk/wetalk-web/dist';

conn.on('ready', () => {
  log('connected');
  conn.sftp(async (e, sftp) => {
    if (e) { console.log('SFTP err', e); process.exit(1); }

    // 清旧 dist
    await new Promise(r => sftp.rmdir('/opt/wetalk/dist', { recursive: true }, () => r()));
    await new Promise(r => sftp.mkdir('/opt/wetalk/dist', () => r()));
    await new Promise(r => sftp.mkdir('/opt/wetalk/dist/assets', () => r()));

    // 读 index.html
    const indexHtml = readFileSync(join(distDir, 'index.html'));
    await new Promise((res, rej) => {
      const ws = sftp.createWriteStream('/opt/wetalk/dist/index.html');
      ws.on('close', res); ws.on('error', rej);
      ws.end(indexHtml);
    });
    log('index.html uploaded');

    // 读 assets
    const assetsDir = join(distDir, 'assets');
    for (const f of readdirSync(assetsDir)) {
      const fp = join(assetsDir, f);
      const data = readFileSync(fp);
      await new Promise((res, rej) => {
        const ws = sftp.createWriteStream(`/opt/wetalk/dist/assets/${f}`);
        ws.on('close', res); ws.on('error', rej);
        ws.end(data);
      });
      log(`uploaded: assets/${f} (${(data.length/1024).toFixed(0)}KB)`);
    }

    // 验证
    const test = await new Promise((res, rej) => {
      conn.exec('curl -s -o /dev/null -w "%{http_code}" http://localhost:8088/', (e2, s) => {
        if (e2) return rej(e2);
        let out = '';
        s.on('data', d => out += d.toString());
        s.on('close', () => res(out));
      });
    });
    log('nginx 8088 =>', test);

    conn.end();
    log('DONE');
  });
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 30000 });
