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
async function api(method, path, token, body) {
  const headers = `'Content-Type: application/json'${token ? ` -H 'Authorization: Bearer ${token}'` : ''}`;
  const data = body ? `-d '${JSON.stringify(body)}'` : '';
  const cmd = `curl -s -w '\\n__HTTP:%{http_code}' -X ${method} http://localhost:8082${path} -H ${headers} ${data}`;
  const r = await exec(cmd);
  const m = r.stdout.match(/__HTTP:(\d+)/);
  return { code: m ? m[1] : 'ERR', resp: r.stdout.replace(/__HTTP:\d+/, '').trim() };
}
const pass = (name, r) => console.log(`${r.code>=200&&r.code<300?'✅':'❌'} ${name}: ${r.code} ${r.resp.slice(0,150)}`);

conn.on('ready', async () => {
  // 清日志先
  await exec('echo "" > /opt/wetalk/wetalk.log');

  // 登录
  const l = await api('POST', '/api/auth/login', null, { username: 'testall1', password: 'Test123456' });
  const token = l.resp.match(/"accessToken":"([^"]+)"/)?.[1] || '';
  const l2 = await api('POST', '/api/auth/login', null, { username: 'testall2', password: 'Test123456' });
  const uid2 = l2.resp.match(/"id":(\d+)/)?.[1] || '8';
  pass('login', l);

  // ===== 用正确路径重新测试 =====
  // Messages - unread
  const unread = await api('GET', '/api/messages/unread', token);
  pass('未读消息', unread);

  // Groups - list
  const grps = await api('GET', '/api/groups', token);
  pass('我的群聊', grps);

  // Groups - add member (正确参数格式)
  const grpId = grps.resp.match(/"id":(\d+)/)?.[1] || '1';
  const addMem = await api('POST', `/api/groups/${grpId}/members?userIds=${uid2}`, token);
  pass('添加群成员', addMem);

  // Social - 正确路径
  const socPub = await api('POST', '/api/posts', token, { content: 'hello world', imageKeys: [] });
  pass('发朋友圈', socPub);

  const socFeed = await api('GET', '/api/posts/feed', token);
  pass('朋友圈Feed', socFeed);

  // Wallet - 正确路径
  const wallet = await api('GET', '/api/wallet', token);
  pass('钱包', wallet);

  // Open - 正确路径
  const keys = await api('GET', '/api/open/keys', token);
  pass('API Keys', keys);

  // E2EE - 正确路径
  const e2ee = await api('PUT', '/api/users/e2ee/public-key', token, { publicKey: 'test-key' });
  pass('E2EE公钥', e2ee);

  // Files - 正确参数
  const presign = await api('POST', '/api/files/presign', token, { filename: 'test.txt', contentType: 'text/plain', size: 100 });
  pass('文件预签名', presign);

  // Todos - 正确参数
  const todo = await api('POST', '/api/todos', token, { content: 'test todo' });
  pass('添加待办', todo);

  // AI (不在主jar, 预期失败)
  const aiChat = await api('POST', '/api/ai/chat', token, { message: '你好', history: [], useKnowledge: false });
  pass('AI对话', aiChat);

  // ===== 抓错误栈 =====
  log('\n=== 错误栈 ===');
  const err = await exec('grep -B1 -A5 "ERROR" /opt/wetalk/wetalk.log | grep -v Kafka | grep -v "msg.offline" | tail -60');
  log(err.stdout.trim());

  conn.end();
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 30000 });
