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
  const checks = [
    ['mongo binary download', 'ls -lh /tmp/mongo.tgz 2>/dev/null || echo NO_FILE; ls -lh /tmp/mongodb-* 2>/dev/null || echo NO_DIR'],
    ['download process', 'ps aux | grep curl | grep -v grep || echo NO_CURL'],
    ['network speed', 'curl -s -o /dev/null -w "fastdl speed: %{speed_download}B/s time=%{time_total}s\\n" https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2204-7.0.14.tgz --max-time 10 2>&1'],
    ['mongod check', 'which mongod 2>/dev/null && mongod --version || echo NO_MONGOD'],
  ];
  for (const [label, cmd] of checks) {
    const r = await exec(cmd);
    console.log(`\n=== ${label} ===\n${r.stdout}${r.stderr}`);
  }
  conn.end();
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 15000 });
