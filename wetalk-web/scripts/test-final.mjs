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
async function api(method, path, token, body, params) {
  let url = `http://localhost:8082${path}`;
  if (params) url += '?' + Object.entries(params).map(([k,v])=>`${k}=${v}`).join('&');
  const headers = `'Content-Type: application/json'${token ? ` -H 'Authorization: Bearer ${token}'` : ''}`;
  const data = body ? `-d '${JSON.stringify(body)}'` : '';
  const cmd = `curl -s -w '\\n__HTTP:%{http_code}' -X ${method} '${url}' -H ${headers} ${data}`;
  const r = await exec(cmd);
  const m = r.stdout.match(/__HTTP:(\d+)/);
  return { code: m ? m[1] : 'ERR', resp: r.stdout.replace(/__HTTP:\d+/, '').trim() };
}
const pass = (name, r) => console.log(`${r.code>=200&&r.code<300?'✅':'❌'} ${name}: ${r.code} ${r.resp.slice(0,150)}`);

conn.on('ready', async () => {
  // 登录两个号
  const l1 = await api('POST', '/api/auth/login', null, { username: 'testall1', password: 'Test123456' });
  const t1 = l1.resp.match(/"accessToken":"([^"]+)"/)?.[1] || '';
  const u1 = l1.resp.match(/"id":(\d+)/)?.[1] || '7';
  const l2 = await api('POST', '/api/auth/login', null, { username: 'testall2', password: 'Test123456' });
  const t2 = l2.resp.match(/"accessToken":"([^"]+)"/)?.[1] || '';
  const u2 = l2.resp.match(/"id":(\d+)/)?.[1] || '8';

  log('\n===== 核心功能 =====');
  pass('当前用户', await api('GET', '/api/auth/me', t1));
  pass('好友列表', await api('GET', '/api/friends', t1));

  log('\n===== 消息功能 =====');
  const convId = `dm:${Math.min(+u1,+u2)}:${Math.max(+u1,+u2)}`;
  pass('发送消息', await api('POST', '/api/messages', t1, { receiverId: +u2, type: 'TEXT', content: 'test msg' }));
  pass('历史消息', await api('GET', '/api/messages/history', t1, null, { conversationId: convId }));
  pass('未读消息', await api('GET', '/api/messages/unread', t1, null, { conversationIds: convId }));
  pass('清除未读', await api('POST', '/api/messages/unread/clear', t1, null, { conversationId: convId }));
  pass('消息搜索(ES降级)', await api('GET', '/api/messages/search', t1, null, { conversationId: convId, keyword: 'test' }));
  pass('全局搜索(ES降级)', await api('GET', '/api/messages/search/global', t1, null, { keyword: 'test' }));

  // 获取消息ID做后续操作
  const hist = await api('GET', '/api/messages/history', t1, null, { conversationId: convId });
  const msgId = hist.resp.match(/"id":"([^"]+)"/)?.[1];
  if (msgId) {
    pass('按ID查消息', await api('GET', `/api/messages/${msgId}`, t1));
    pass('置顶消息', await api('POST', `/api/messages/${msgId}/pin`, t1));
    pass('置顶列表', await api('GET', '/api/messages/pinned', t1, null, { conversationId: convId }));
    pass('取消置顶', await api('DELETE', `/api/messages/${msgId}/pin`, t1));
    pass('转发消息', await api('POST', `/api/messages/${msgId}/forward`, t1, { targets: [{ type: 'dm', targetId: +u2 }] }));
    pass('撤回消息', await api('POST', `/api/messages/${msgId}/recall`, t1));
  }

  // 白板
  pass('白板历史', await api('GET', '/api/messages/whiteboard', t1, null, { conversationId: convId }));

  // 定时消息
  pass('定时发送', await api('POST', '/api/messages/schedule', t1, { receiverId: +u2, content: 'scheduled', sendAt: '2026-09-23T23:59:00' }));
  pass('定时列表', await api('GET', '/api/messages/schedule', t1));

  log('\n===== 用户功能 =====');
  pass('按ID查用户', await api('GET', `/api/users/${u2}`, t1));
  pass('搜索用户', await api('GET', '/api/users/search', t1, null, { keyword: 'test' }));
  pass('E2EE公钥设置', await api('PUT', '/api/users/e2ee-key', t1, { publicKey: 'test-key-jwk' }));
  pass('E2EE公钥查询', await api('GET', `/api/users/${u2}/e2ee-key`, t1));

  log('\n===== 群聊功能 =====');
  const grp = await api('POST', '/api/groups', t1, { name: 'TestGrp2', memberIds: [+u2] });
  const gid = grp.resp.match(/"id":(\d+)/)?.[1] || '1';
  pass('创建群聊', grp);
  pass('我的群聊', await api('GET', '/api/groups/my', t1));
  pass('群详情', await api('GET', `/api/groups/${gid}`, t1));
  pass('群公告', await api('PUT', `/api/groups/${gid}/announcement`, t1, { announcement: 'new ann' }));
  pass('群文件列表', await api('GET', '/api/messages/group-files', t1, null, { groupId: gid }));

  log('\n===== 文件功能 =====');
  pass('文件预签名', await api('POST', '/api/files/presign', t1, { fileName: 'test.txt', contentType: 'text/plain', clientMsgId: 'test-msg-1' }));

  log('\n===== 朋友圈 =====');
  pass('发朋友圈', await api('POST', '/api/posts', t1, { content: 'hello world', imageKeys: [] }));
  pass('朋友圈Feed', await api('GET', '/api/posts/feed', t1));

  log('\n===== 钱包 =====');
  pass('钱包余额', await api('GET', '/api/wallet', t1));

  log('\n===== 频道 =====');
  pass('频道列表', await api('GET', '/api/channels', t1));

  log('\n===== 收藏/待办 =====');
  pass('收藏列表', await api('GET', '/api/favorites', t1));
  pass('待办列表', await api('GET', '/api/todos', t1));
  const todoR = await api('POST', '/api/todos', t1, { content: 'test' });
  pass('添加待办', todoR);

  log('\n===== 语音房间 =====');
  pass('语音房间列表', await api('GET', '/api/voip/rooms', t1));

  log('\n===== 开放平台 =====');
  pass('API Keys', await api('GET', '/api/open/keys', t1));
  pass('Webhooks', await api('GET', '/api/open/webhooks', t1));

  log('\n===== AI (独立服务, 预期不可用) =====');
  pass('AI对话', await api('POST', '/api/ai/chat', t1, { message: '你好', history: [], useKnowledge: false }));

  conn.end();
  log('\nDONE');
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 30000 });
