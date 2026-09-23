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
  const t1 = await exec(`curl -s -X POST http://localhost:8082/api/auth/login -H 'Content-Type: application/json' -d '{"username":"testuser1","password":"Test123456"}'`);
  const tk1 = t1.stdout.match(/"accessToken":"([^"]+)"/)?.[1];
  const t2 = await exec(`curl -s -X POST http://localhost:8082/api/auth/login -H 'Content-Type: application/json' -d '{"username":"testuser2","password":"Test123456"}'`);
  const tk2 = t2.stdout.match(/"accessToken":"([^"]+)"/)?.[1];
  log('tokens ok');

  // 正确路径：POST /api/messages 发送
  log('\n=== 发送消息 (POST /api/messages) ===');
  const send = await exec(`curl -s -w '\\nHTTP:%{http_code}' -X POST http://localhost:8082/api/messages -H 'Authorization: Bearer ${tk1}' -H 'Content-Type: application/json' -d '{"receiverId":2,"type":"TEXT","content":"hello from t1"}'`);
  log(send.stdout.trim().slice(0, 500));

  // 好友请求路径也查一下
  log('\n=== 好友列表 ===');
  const friends = await exec(`curl -s http://localhost:8082/api/friends -H 'Authorization: Bearer ${tk1}'`);
  log(friends.stdout.trim().slice(0, 300));

  // 会话列表
  log('\n=== 会话列表 ===');
  const convs = await exec(`curl -s http://localhost:8082/api/conversations -H 'Authorization: Bearer ${tk1}'`);
  log(convs.stdout.trim().slice(0, 300));

  // 最新错误
  log('\n=== 最新错误 ===');
  const err = await exec('grep -E "ERROR|Caused" /opt/wetalk/wetalk.log | tail -10');
  log(err.stdout.trim() || '(无错误！)');

  conn.end();
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 30000 });
