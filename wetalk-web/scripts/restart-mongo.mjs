import { Client } from 'ssh2';

const conn = new Client();
const log = (...a) => console.log('[U]', ...a);
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
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

conn.on('ready', async () => {
  log('1. kill backend');
  await exec('pkill -f "wetalk-app" 2>/dev/null; sleep 2; echo ok');

  log('2. kill mongod');
  await exec('pkill mongod 2>/dev/null; sleep 2; echo ok');

  log('3. start mongod WITHOUT auth');
  const r1 = await exec('mongod --dbpath /data/mongo --port 27017 --bind_ip 127.0.0.1 --fork --logpath /var/log/mongod.log 2>&1');
  log(r1.stdout.trim());
  await sleep(2000);

  // 验证无 auth
  const r2 = await exec('which mongosh || which mongo');
  const sh = r2.stdout.trim();
  log('shell:', sh);
  if (sh) {
    const r3 = await exec(`${sh} --quiet wetalk --eval "db.getCollectionNames()" 2>&1`);
    log('collections:', r3.stdout.trim());
  }

  log('4. start backend');
  await exec('bash /opt/wetalk/start.sh 2>&1');

  log('5. wait for backend');
  for (let i = 0; i < 30; i++) {
    const h = await exec('curl -s -o /dev/null -w "%{http_code}" http://localhost:8082/actuator/health 2>&1');
    if (h.stdout.trim() === '200') { log('BACKEND UP!'); break; }
    await sleep(5000);
  }

  // 测试发消息
  log('\n6. test send message');
  const tokenResp = await exec(`curl -s -X POST http://localhost:8082/api/auth/login -H 'Content-Type: application/json' -d '{"username":"testuser1","password":"Test123456"}'`);
  const match = tokenResp.stdout.match(/"accessToken":"([^"]+)"/);
  if (match) {
    const token = match[1];
    const send = await exec(`curl -s -w '\\nHTTP:%{http_code}' -X POST http://localhost:8082/api/messages/send -H 'Authorization: Bearer ${token}' -H 'Content-Type: application/json' -d '{"receiverId":2,"type":"TEXT","content":"hello from testuser1"}'`);
    log('send result:', send.stdout.trim().slice(0, 400));

    const history = await exec(`curl -s -w '\\nHTTP:%{http_code}' http://localhost:8082/api/messages/history -H 'Authorization: Bearer ${token}'`);
    log('history:', history.stdout.trim().slice(0, 400));
  }

  conn.end();
  log('\nDONE');
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 30000 });
