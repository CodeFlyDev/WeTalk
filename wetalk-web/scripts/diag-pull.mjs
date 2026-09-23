import { Client } from 'ssh2';
const conn = new Client();
function exec(cmd, timeout = 30000) {
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
  // 测一下服务器基本网速
  console.log('=== speed test ===');
  const speed = await exec('curl -s -o /dev/null -w "HTTP %{http_code} time=%{time_total}s speed=%{speed_download}B/s\\n" https://www.google.com 2>&1', 15000);
  console.log('google:', speed.stdout, speed.stderr);

  // 测试 daocloud 是否有 mongo:7
  console.log('\n=== test daocloud mongo:7 ===');
  const t1 = await exec('curl -sI https://docker.m.daocloud.io/v2/library/mongo/manifests/7 2>&1 | head -5', 15000);
  console.log(t1.stdout);

  // 测试 1ms.run
  console.log('\n=== test 1ms.run mongo:7 ===');
  const t2 = await exec('curl -sI https://docker.1ms.run/v2/library/mongo/manifests/7 2>&1 | head -5', 15000);
  console.log(t2.stdout);

  // 测试 docker hub 直接
  console.log('\n=== test docker hub direct ===');
  const t3 = await exec('curl -sI https://registry-1.docker.io/v2/library/mongo/manifests/7 2>&1 | head -5', 15000);
  console.log(t3.stdout);

  // 试试 1ms.run pull（更短超时测试）
  console.log('\n=== try 1ms.run pull 30s ===');
  const r = await exec('timeout 30 docker pull docker.1ms.run/library/mongo:7 2>&1', 35000);
  console.log('code:', r.code);
  console.log((r.stdout + r.stderr).slice(-500));

  conn.end();
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 15000 });
