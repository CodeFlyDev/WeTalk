import { Client } from 'ssh2';
const conn = new Client();
const log = (...a) => console.log('[U]', ...a);
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
  // 抓取所有 ERROR 级别日志，去重后展示
  const r = await exec('grep "ERROR" /opt/wetalk/wetalk.log | grep -v "Kafka" | grep -v "offline" | tail -30');
  log(r.stdout.trim());

  log('\n=== Caused by ===');
  const r2 = await exec('grep "Caused by" /opt/wetalk/wetalk.log | sort -u | tail -20');
  log(r2.stdout.trim());

  log('\n=== 非Kafka ERROR 详情 ===');
  const r3 = await exec('grep -B1 -A3 "ERROR" /opt/wetalk/wetalk.log | grep -v "Kafka" | grep -v "offline" | grep -v "msg\\.offline" | tail -60');
  log(r3.stdout.trim());

  conn.end();
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 30000 });
