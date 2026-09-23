import { Client } from 'ssh2';
const conn = new Client();
const log = (...a) => console.log('[U]', ...a);
function exec(cmd, timeout = 20000) {
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
  // 先手动触发一次发请求
  const tokenResp = await exec(`curl -s -X POST http://localhost:8082/api/auth/login -H 'Content-Type: application/json' -d '{"username":"testuser1","password":"Test123456"}'`);
  const m = tokenResp.stdout.match(/"accessToken":"([^"]+)"/);
  if (m) {
    // 好友关系
    const f = await exec(`curl -s http://localhost:8082/api/friends -H 'Authorization: Bearer ${m[1]}'`);
    log('friends:', f.stdout.trim().slice(0, 200));

    // 尝试添加好友（testuser1 加 testuser2，userid=2）
    const a = await exec(`curl -s -w '\\nHTTP:%{http_code}' -X POST http://localhost:8082/api/friends/request -H 'Authorization: Bearer ${m[1]}' -H 'Content-Type: application/json' -d '{"toUserId":2}'`);
    log('add friend:', a.stdout.trim().slice(0, 300));

    // 发消息
    const s = await exec(`curl -s -w '\\nHTTP:%{http_code}' -X POST http://localhost:8082/api/messages/send -H 'Authorization: Bearer ${m[1]}' -H 'Content-Type: application/json' -d '{"receiverId":2,"type":"TEXT","content":"hi"}'`);
    log('send:', s.stdout.trim().slice(0, 400));
  }

  // 立即查错误
  log('\n=== errors ===');
  const e = await exec('grep -E "ERROR|Caused|Exception" /opt/wetalk/wetalk.log | tail -20');
  log(e.stdout.trim());

  conn.end();
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 30000 });
