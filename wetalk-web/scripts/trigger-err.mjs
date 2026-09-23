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
  // 登录
  const l = await exec(`curl -s -X POST http://localhost:8082/api/auth/login -H 'Content-Type: application/json' -d '{"username":"testall1","password":"Test123456"}'`);
  const token = l.stdout.match(/"accessToken":"([^"]+)"/)?.[1] || '';

  // 触发错误
  await exec(`curl -s http://localhost:8082/api/messages/unread -H 'Authorization: Bearer ${token}' > /dev/null`);
  await exec(`curl -s http://localhost:8082/api/groups -H 'Authorization: Bearer ${token}' > /dev/null`);
  await exec(`curl -s -X PUT http://localhost:8082/api/users/e2ee/public-key -H 'Authorization: Bearer ${token}' -H 'Content-Type: application/json' -d '{"publicKey":"test"}' > /dev/null`);

  // 抓栈
  log('=== unread/groups/e2ee 错误栈 ===');
  const r = await exec('grep -A10 "unhandled exception" /opt/wetalk/wetalk.log | head -80');
  log(r.stdout.trim());

  conn.end();
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 30000 });
