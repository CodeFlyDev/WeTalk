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
  const t1 = await exec(`curl -s -X POST http://localhost:8082/api/auth/login -H 'Content-Type: application/json' -d '{"username":"testuser1","password":"Test123456"}'`);
  const tk1 = t1.stdout.match(/"accessToken":"([^"]+)"/)?.[1];

  // 触发 conversations 错误
  log('=== conversations ===');
  await exec(`curl -s http://localhost:8082/api/conversations -H 'Authorization: Bearer ${tk1}' > /dev/null`);

  // 立即查最尾部带 "conversations" 或 "Caused" 的
  const err = await exec('tail -100 /opt/wetalk/wetalk.log | grep -A2 "conversations\\|Caused\\|unhandled" | tail -40');
  log(err.stdout.trim());

  // 查 ConversationsController
  log('\n=== find conversation controller ===');
  const cc = await exec('grep -r "RequestMapping.*conversation" /opt/wetalk/wetalk.log 2>/dev/null | head -3; echo "---"');
  log(cc.stdout.trim());

  // 帮两个测试用户加好友，验证发消息链路
  log('\n=== 添加好友 ===');
  // testuser2 登录
  const t2 = await exec(`curl -s -X POST http://localhost:8082/api/auth/login -H 'Content-Type: application/json' -d '{"username":"testuser2","password":"Test123456"}'`);
  const tk2 = t2.stdout.match(/"accessToken":"([^"]+)"/)?.[1];

  // testuser1 发好友请求
  const r1 = await exec(`curl -s -w '\\nHTTP:%{http_code}' -X POST http://localhost:8082/api/friend-requests -H 'Authorization: Bearer ${tk1}' -H 'Content-Type: application/json' -d '{"toUserId":2,"message":"hi"}'`);
  log('send request:', r1.stdout.trim().slice(0, 300));

  // 看有哪些好友相关接口
  log('\n=== friend request endpoints ===');
  const fr = await exec('grep -rE "PostMapping|GetMapping.*friend|RequestMapping.*friend" /opt/wetalk/wetalk.log 2>/dev/null | head -5; echo done');
  log(fr.stdout.trim());

  conn.end();
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 30000 });
