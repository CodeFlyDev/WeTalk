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
  log('=== recent errors ===');
  const e1 = await exec('grep -E "ERROR|Exception|Caused|FORBIDDEN|send|deliver|friend" /opt/wetalk/wetalk.log | tail -40');
  log(e1.stdout.trim() || '(no errors)');

  log('\n=== tail 50 ===');
  const e2 = await exec('tail -50 /opt/wetalk/wetalk.log');
  log(e2.stdout.trim());

  // 也测一下发消息的 API
  log('\n=== test message send ===');
  // 先登录拿 token
  const tokenResp = await exec(`curl -s -X POST http://localhost:8082/api/auth/login -H 'Content-Type: application/json' -d '{"username":"testuser1","password":"Test123456"}'`);
  const match = tokenResp.stdout.match(/"accessToken":"([^"]+)"/);
  if (match) {
    const token = match[1];
    log('got token');

    // 看看好友关系
    const friends = await exec(`curl -s http://localhost:8082/api/friends -H 'Authorization: Bearer ${token}'`);
    log('friends:', friends.stdout.trim().slice(0, 300));

    // 看看 testuser1 和 testuser2 是不是好友（互相加一下）
    // testuser2 的 token
    const t2 = await exec(`curl -s -X POST http://localhost:8082/api/auth/login -H 'Content-Type: application/json' -d '{"username":"testuser2","password":"Test123456"}'`);
    const m2 = t2.stdout.match(/"accessToken":"([^"]+)"/);
    if (m2) {
      log('got token2');
      const addFriend = await exec(`curl -s -X POST http://localhost:8082/api/friends/request -H 'Authorization: Bearer ${token}' -H 'Content-Type: application/json' -d '{"toUserId":2}'`);
      log('send request:', addFriend.stdout.trim().slice(0, 200));
    }

    // 尝试发消息给 testuser2
    const send = await exec(`curl -s -w '\\nHTTP:%{http_code}' -X POST http://localhost:8082/api/messages/send -H 'Authorization: Bearer ${token}' -H 'Content-Type: application/json' -d '{"receiverId":2,"type":"TEXT","content":"hello from testuser1"}'`);
    log('send msg:', send.stdout.trim().slice(0, 500));
  }

  conn.end();
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 30000 });
