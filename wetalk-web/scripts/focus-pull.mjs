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
  // kill compose up，只留单独 docker pull
  await exec('pkill -f "docker compose up" 2>/dev/null; sleep 1; echo compose_killed');
  // 检查剩余 pull
  const ps = await exec('ps aux | grep "docker pull" | grep -v grep');
  console.log('remaining pulls:\n' + ps.stdout);
  // 等 pull 完成（轮询）
  for (let i = 0; i < 40; i++) {
    const r = await exec('docker images --format "{{.Repository}}:{{.Tag}}" | grep mongo');
    if (r.stdout.includes('mongo')) {
      console.log('MONGO READY:', r.stdout.trim());
      break;
    }
    const pulls = await exec('ps aux | grep "docker pull" | grep -v grep | wc -l');
    console.log(`  [${i}] pull processes: ${pulls.stdout.trim()}`);
    if (pulls.stdout.trim() === '0') {
      console.log('NO PULL PROCESSES RUNNING - failed');
      break;
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  // 最终镜像
  const imgs = await exec('docker images | grep mongo');
  console.log('\n=== final ===\n' + imgs.stdout);
  conn.end();
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 15000 });
