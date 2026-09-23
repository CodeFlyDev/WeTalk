import { Client } from 'ssh2';
const conn = new Client();
const sleep = ms => new Promise(r => setTimeout(r, ms));
function exec(cmd, timeout = 60000) {
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
  console.log('[R] diagnose + restart mongo download');

  // 1. 查当前状态
  const fsize = await exec('ls -lh /tmp/mongo.tgz 2>/dev/null; pgrep -fa curl || echo NO_CURL');
  console.log('state:\n' + fsize.stdout);

  // 2. kill 卡住的 curl
  await exec('pkill -f "curl.*mongo" 2>/dev/null; sleep 2; echo killed');

  // 3. 看 curl log
  const clog = await exec('tail -5 /tmp/curl.log 2>/dev/null || echo NO_LOG');
  console.log('curl log:', clog.stdout.trim());

  // 4. 重新下载（用 wget 试试，或继续 curl 但加 resume）
  console.log('\nrestarting download with curl -C - ...');
  const dl = await exec(`cd /tmp && nohup curl -fSL -C - -o mongo.tgz "https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2204-7.0.14.tgz" > /tmp/curl2.log 2>&1 & disown; echo PID=$!`);
  console.log(dl.stdout.trim());

  // 5. 监控 2 分钟
  for (let i = 0; i < 8; i++) {
    const fs = await exec('stat -c %s /tmp/mongo.tgz 2>/dev/null || echo 0');
    const sizeMB = (parseInt(fs.stdout.trim()) / 1024 / 1024).toFixed(1);
    console.log(`  [${i}] mongo.tgz: ${sizeMB}MB`);
    await sleep(15000);
  }

  // 6. 检查是否还在涨
  const finalSize = await exec('stat -c %s /tmp/mongo.tgz 2>/dev/null || echo 0');
  const curlAlive = await exec('pgrep -fa curl');
  console.log('\nfinal size:', (parseInt(finalSize.stdout.trim()) / 1024 / 1024).toFixed(1) + 'MB');
  console.log('curl alive:', curlAlive.stdout.trim());

  conn.end();
  console.log('\nDONE');
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 15000 });
