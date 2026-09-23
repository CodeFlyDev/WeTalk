import { Client } from 'ssh2';
const conn = new Client();
const log = (...a) => console.log('[TEST]', ...a);

conn.on('ready', async () => {
  log('SSH connected');
  conn.exec('uname -a; docker ps --format "{{.Names}} {{.Status}}"', (e, stream) => {
    if (e) { log('exec error', e.message); conn.end(); return; }
    let out = '';
    stream.on('data', d => out += d).on('stderr', d => out += d).on('close', () => {
      log('output:', out);
      conn.end();
    });
  });
}).on('error', e => { log('connect error', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 15000 });
