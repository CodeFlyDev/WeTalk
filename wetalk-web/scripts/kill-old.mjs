import { Client } from 'ssh2';
const conn = new Client();
function exec(cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (e, stream) => {
      if (e) return reject(e);
      let out = '', errOut = '';
      stream.on('data', d => out += d.toString());
      stream.on('stderr', d => errOut += d.toString());
      stream.on('close', code => resolve({ code, stdout: out, stderr: errOut }));
    });
  });
}
conn.on('ready', async () => {
  // kill 旧的 docker compose up (PID 3363515 来自 deploy.mjs)，保留 3364543
  const kill = await exec('kill 3363514 3363515 2>/dev/null; echo killed-old');
  console.log(kill.stdout);
  const ps = await exec('ps aux | grep "docker compose" | grep -v grep');
  console.log('remaining:\n' + ps.stdout);
  conn.end();
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 15000 });
