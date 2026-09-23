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
  // 查完整错误
  const log = await exec('grep -A 3 "ERROR\\|Caused by\\|Exception" /opt/wetalk/wetalk.log | head -60');
  console.log('=== errors ===\n' + log.stdout);
  
  // 看尾部
  const tail = await exec('tail -80 /opt/wetalk/wetalk.log');
  console.log('\n=== tail ===\n' + tail.stdout);

  // 检查 Java 进程是否还活着
  const ps = await exec('pgrep -fa "wetalk-app" || echo DEAD');
  console.log('\nbackend process:', ps.stdout.trim());

  // 查 MongoDB 连接
  const mongo = await exec('mongod --version 2>/dev/null || echo NO_MONGOD');
  console.log('\nmongod version:', mongo.stdout.trim());
  
  // 端口检查
  const ports = await exec('ss -tlnp | grep -E "27017|3307|6380|9002|8082"');
  console.log('\nports:\n' + ports.stdout);

  conn.end();
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 15000 });
