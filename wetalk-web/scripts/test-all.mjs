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
  const code = m ? m[1] : 'ERR';
  const resp = r.stdout.replace(/__HTTP:\d+/, '').trim();
  return { code, resp };
}

conn.on('ready', async () => {
  const results = [];
  const pass = (name, { code, resp }) => {
    const ok = code >= 200 && code < 300;
    const tag = ok ? '✅' : '❌';
    const detail = resp.slice(0, 150);
    results.push(`${tag} ${name}: ${code} ${detail}`);
    console.log(`${tag} ${name}: ${code} ${detail}`);
  };

  // ===== 1. Auth =====
  const reg = await api('POST', '/api/auth/register', null, { username: 'testall1', password: 'Test123456', nickname: 'TA1' });
  pass('注册 testall1', reg);

  const login = await api('POST', '/api/auth/login', null, { username: 'testall1', password: 'Test123456' });
  pass('登录 testall1', login);

  const token = login.resp.match(/"accessToken":"([^"]+)"/)?.[1] || '';
  const uid = login.resp.match(/"id":(\d+)/)?.[1] || '1';

  const me = await api('GET', '/api/auth/me', token);
  pass('当前用户', me);

  // 注册第二个号
  await api('POST', '/api/auth/register', null, { username: 'testall2', password: 'Test123456', nickname: 'TA2' });
  const l2 = await api('POST', '/api/auth/login', null, { username: 'testall2', password: 'Test123456' });
  const token2 = l2.resp.match(/"accessToken":"([^"]+)"/)?.[1] || '';
  const uid2 = l2.resp.match(/"id":(\d+)/)?.[1] || '2';

  // ===== 2. Friends =====
  const fList = await api('GET', '/api/friends', token);
  pass('好友列表', fList);

  const fReq = await api('POST', '/api/friends/requests', token, { toUserId: Number(uid2), remark: 'test' });
  pass('发送好友请求', fReq);

  const fReqList = await api('GET', '/api/friends/requests', token2);
  pass('好友请求列表', fReqList);

  const reqId = fReqList.resp.match(/"id":(\d+)/)?.[1];
  if (reqId) {
    const fAccept = await api('POST', `/api/friends/requests/${reqId}/accept`, token2);
    pass('接受好友请求', fAccept);
  }

  // ===== 3. Messages =====
  const msgSend = await api('POST', '/api/messages', token, { receiverId: Number(uid2), type: 'TEXT', content: 'hello test' });
  pass('发送消息', msgSend);

  const convId = `dm:${Math.min(Number(uid),Number(uid2))}:${Math.max(Number(uid),Number(uid2))}`;
  const msgHistory = await api('GET', `/api/messages/history?conversationId=${convId}`, token);
  pass('历史消息', msgHistory);

  const msgUnread = await api('GET', '/api/messages/unread', token);
  pass('未读消息', msgUnread);

  const msgClear = await api('PUT', `/api/messages/unread/${convId}`, token);
  pass('清除未读', msgClear);

  const msgSearch = await api('GET', '/api/messages/search?keyword=hello&conversationId=' + convId, token);
  pass('消息搜索', msgSearch);

  const msgGlobalSearch = await api('GET', '/api/messages/search/global?keyword=hello', token);
  pass('全局消息搜索', msgGlobalSearch);

  const msgId = msgSend.resp.match(/"id":"?(\d+)"?/)?.[1];
  if (msgId) {
    const msgRecall = await api('POST', `/api/messages/${msgId}/recall`, token);
    pass('撤回消息', msgRecall);

    const msgPin = await api('POST', `/api/messages/${msgId}/pin`, token);
    pass('置顶消息', msgPin);

    const msgForward = await api('POST', '/api/messages', token, { receiverId: Number(uid2), type: 'TEXT', content: 'forwarded', forwardOfId: msgId });
    pass('转发消息', msgForward);
  }

  // ===== 4. Users =====
  const userById = await api('GET', `/api/users/${uid2}`, token);
  pass('按ID查用户', userById);

  const userSearch = await api('GET', '/api/users/search?keyword=testall', token);
  pass('搜索用户', userSearch);

  const userE2EE = await api('PUT', '/api/users/e2ee/public-key', token, { publicKey: 'test-pub-key-123' });
  pass('E2EE公钥', userE2EE);

  // ===== 5. Groups =====
  const grpCreate = await api('POST', '/api/groups', token, { name: 'TestGroup', announcement: 'test group' });
  pass('创建群聊', grpCreate);

  const grpList = await api('GET', '/api/groups', token);
  pass('我的群聊', grpList);

  const grpId = grpCreate.resp.match(/"id":"?(\d+)"?/)?.[1] || grpCreate.resp.match(/"groupId":"?(\d+)"?/)?.[1];
  if (grpId) {
    const grpDetail = await api('GET', `/api/groups/${grpId}`, token);
    pass('群详情', grpDetail);

    const grpAddMember = await api('POST', `/api/groups/${grpId}/members`, token, { userIds: [Number(uid2)] });
    pass('添加群成员', grpAddMember);

    const grpAnnouncement = await api('PUT', `/api/groups/${grpId}/announcement`, token, { announcement: 'updated' });
    pass('群公告', grpAnnouncement);
  }

  // ===== 6. Files =====
  const filePresign = await api('POST', '/api/files/presign', token, { filename: 'test.txt', contentType: 'text/plain' });
  pass('文件预签名', filePresign);

  // ===== 7. AI =====
  const aiChat = await api('POST', '/api/ai/chat', token, { message: '你好', conversationId: 'test-conv' });
  pass('AI对话', aiChat);

  const aiSummary = await api('POST', '/api/ai/summary', token, { conversationId: convId });
  pass('AI摘要', aiSummary);

  const aiEmoji = await api('POST', '/api/ai/emoji', token, { text: 'happy' });
  pass('AI表情包', aiEmoji);

  // ===== 8. Channels =====
  const chCreate = await api('POST', '/api/channels', token, { name: 'TestChannel', description: 'test' });
  pass('创建频道', chCreate);

  const chList = await api('GET', '/api/channels', token);
  pass('频道列表', chList);

  // ===== 9. Social (朋友圈) =====
  const socPub = await api('POST', '/api/social/posts', token, { content: 'hello world', images: [] });
  pass('发朋友圈', socPub);

  const socFeed = await api('GET', '/api/social/feed', token);
  pass('朋友圈Feed', socFeed);

  // ===== 10. Favorites =====
  const favList = await api('GET', '/api/favorites', token);
  pass('收藏列表', favList);

  if (msgId) {
    const favAdd = await api('POST', '/api/favorites', token, { messageId: msgId });
    pass('添加收藏', favAdd);
  }

  // ===== 11. Todos =====
  const todoAdd = await api('POST', '/api/todos', token, { title: 'test todo' });
  pass('添加待办', todoAdd);

  const todoList = await api('GET', '/api/todos', token);
  pass('待办列表', todoList);

  // ===== 12. Stats =====
  const statsOverview = await api('GET', '/api/stats/overview', token);
  pass('统计概览', statsOverview);

  // ===== 13. Wallet =====
  const walletBal = await api('GET', '/api/wallet/balance', token);
  pass('钱包余额', walletBal);

  // ===== 14. VoIP =====
  const voipList = await api('GET', '/api/voip/rooms', token);
  pass('语音房间列表', voipList);

  // ===== 15. Open Platform =====
  const openKeys = await api('GET', '/api/open/api-keys', token);
  pass('API Keys', openKeys);

  const openWebhooks = await api('GET', '/api/open/webhooks', token);
  pass('Webhooks', openWebhooks);

  // ===== 总结 =====
  log('\n\n========== 总结 ==========');
  results.forEach(r => log(r));

  conn.end();
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 30000 });
