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
  console.log('[OK]');
  const composeLog = await exec('tail -30 /opt/wetalk/compose-up.log 2>&1 || echo NO_LOG');
  console.log('=== compose-up.log ===\n' + composeLog.stdout);
  const ps = await exec('docker ps -a --format "{{.Names}}\t{{.Status}}\t{{.Image}}" 2>&1');
  console.log('\n=== docker ps -a ===\n' + ps.stdout);
  const images = await exec('docker images --format "{{.Repository}}:{{.Tag}}\t{{.Size}}" 2>&1');
  console.log('\n=== images ===\n' + images.stdout);
  const pull = await exec('ps aux | grep -E "docker pull|docker compose" | grep -v grep 2>&1 || echo NO_PULL');
  console.log('\n=== pull process ===\n' + pull.stdout);
  const df = await exec('df -h / && free -m 2>&1');
  console.log('\n=== disk/mem ===\n' + df.stdout);
  conn.end();
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 15000 });
