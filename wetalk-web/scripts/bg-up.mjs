import { Client } from 'ssh2';
const conn = new Client();
conn.on('ready', () => {
  // 在服务器后台启动 docker compose up，并停掉卡住的 deploy.mjs 本地进程不影响
  const cmd = 'cd /opt/wetalk && nohup bash -c "docker compose up -d > /opt/wetalk/compose-up.log 2>&1" </dev/null >/dev/null 2>&1 & disown; echo LAUNCHED';
  conn.exec(cmd, (e, stream) => {
    if (e) { console.log('ERR', e.message); conn.end(); return; }
    let out = '';
    stream.on('data', d => out += d.toString());
    stream.on('stderr', d => out += d.toString());
    stream.on('close', code => {
      console.log('exit', code);
      console.log(out);
      conn.end();
    });
  });
}).on('error', e => { console.log('CONN ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 15000 });
