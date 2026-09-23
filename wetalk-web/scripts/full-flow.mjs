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
  // 登录
  const l1 = await exec(`curl -s -X POST http://localhost:8082/api/auth/login -H 'Content-Type: application/json' -d '{"username":"testuser1","password":"Test123456"}'`);
  const tk1 = l1.stdout.match(/"accessToken":"([^"]+)"/)[1];
  const uid1 = l1.stdout.match(/"id":(\d+)/)[1];
  log(`t1 logged in, id=${uid1}`);

  const l2 = await exec(`curl -s -X POST http://localhost:8082/api/auth/login -H 'Content-Type: application/json' -d '{"username":"testuser2","password":"Test123456"}'`);
  const tk2 = l2.stdout.match(/"accessToken":"([^"]+)"/)[1];
  const uid2 = l2.stdout.match(/"id":(\d+)/)[1];
  log(`t2 logged in, id=${uid2}`);

  // t1 加 t2 好友 (POST /api/friends/requests)
  log('\n=== t1 申请加 t2 ===');
  const r1 = await exec(`curl -s -w '\\nHTTP:%{http_code}' -X POST http://localhost:8082/api/friends/requests -H 'Authorization: Bearer ${tk1}' -H 'Content-Type: application/json' -d '{"toUserId":${uid2},"remark":"hi"}'`);
  log(r1.stdout.trim().slice(0, 400));

  // t2 查看待处理申请
  log('\n=== t2 查看待处理申请 ===');
  const r2 = await exec(`curl -s -w '\\nHTTP:%{http_code}' http://localhost:8082/api/friends/requests -H 'Authorization: Bearer ${tk2}'`);
  log(r2.stdout.trim().slice(0, 400));

  // t2 接受（用 requestId）
  const reqId = r2.stdout.match(/"id":(\d+)/)?.[1];
  if (reqId) {
    log(`\n=== t2 接受申请 id=${reqId} ===`);
    const r3 = await exec(`curl -s -w '\\nHTTP:%{http_code}' -X POST http://localhost:8082/api/friends/requests/${reqId}/accept -H 'Authorization: Bearer ${tk2}'`);
    log(r3.stdout.trim());

    // 双方好友列表
    log('\n=== t1 friends ===');
    const f1 = await exec(`curl -s http://localhost:8082/api/friends -H 'Authorization: Bearer ${tk1}'`);
    log(f1.stdout.trim().slice(0, 300));

    log('\n=== t2 friends ===');
    const f2 = await exec(`curl -s http://localhost:8082/api/friends -H 'Authorization: Bearer ${tk2}'`);
    log(f2.stdout.trim().slice(0, 300));

    // 发消息
    log('\n=== t1 发消息给 t2 ===');
    const s = await exec(`curl -s -w '\\nHTTP:%{http_code}' -X POST http://localhost:8082/api/messages -H 'Authorization: Bearer ${tk1}' -H 'Content-Type: application/json' -d '{"receiverId":${uid2},"type":"TEXT","content":"hello my friend!"}'`);
    log(s.stdout.trim().slice(0, 500));

    // 历史消息
    const convId = `dm:${uid1}:${uid2}`;
    log(`\n=== 拉历史 conv=${convId} ===`);
    const h = await exec(`curl -s -w '\\nHTTP:%{http_code}' "http://localhost:8082/api/messages/history?conversationId=${convId}&before=" -H 'Authorization: Bearer ${tk1}'`);
    log(h.stdout.trim().slice(0, 500));
  } else {
    log('NO pending request found');
  }

  // 最新后端错误
  log('\n=== recent errors ===');
  const e = await exec('grep "ERROR" /opt/wetalk/wetalk.log | tail -5');
  log(e.stdout.trim() || '(None!)');

  conn.end();
  log('\nDONE');
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 30000 });
