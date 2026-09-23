import { Client } from 'ssh2';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const conn = new Client();
const log = (...a) => console.log('[U]', ...a);
const distDir = 'e:/Github/WeTalk/wetalk-web/dist';

function exec(cmd, timeout = 15000) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { timeout }, (e, stream) => {
      if (e) return reject(e);
      let out = '', errOut = '';
      stream.on('data', d => out += d.toString());
      stream.on('stderr', d => errOut += d.toString());
      stream.on('close', code => resolve({ code, stdout: out, stderr: errOut }));
    });
  });
}

conn.on('ready', async () => {
  log('connected');

  // 清旧文件、建目录
  await exec('rm -rf /opt/wetalk/dist && mkdir -p /opt/wetalk/dist/assets && echo ok');
  log('dirs ready');

  const sftp = await new Promise((res, rej) => conn.sftp((e, s) => e ? rej(e) : res(s)));

  function upload(localPath, remotePath) {
    return new Promise((res, rej) => {
      const data = readFileSync(localPath);
      const ws = sftp.createWriteStream(remotePath);
      ws.on('close', () => res(data.length));
      ws.on('error', rej);
      ws.end(data);
    });
  }

  // index.html
  const sz = await upload(join(distDir, 'index.html'), '/opt/wetalk/dist/index.html');
  log(`index.html ${sz} bytes`);

  // assets
  const assetsDir = join(distDir, 'assets');
  for (const f of readdirSync(assetsDir)) {
    const sz2 = await upload(join(assetsDir, f), `/opt/wetalk/dist/assets/${f}`);
    log(`assets/${f} ${sz2} bytes`);
  }

  // 验证
  const r = await exec('curl -s -o /dev/null -w "%{http_code}" http://localhost:8088/');
  log('nginx 8088 =>', r.stdout.trim());

  conn.end();
  log('DONE');
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 30000 });
