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
  log('connected');

  // 直接测后端
  const r1 = await exec(`curl -s -w '\\nHTTP_CODE:%{http_code}' -X POST http://localhost:8082/api/auth/register -H 'Content-Type: application/json' -d '{"username":"testuser1","password":"Test123456","nickname":"Test1"}'`);
  log('backend direct register:', r1.stdout.trim());

  const r2 = await exec(`curl -s -w '\\nHTTP_CODE:%{http_code}' -X POST http://localhost:8082/api/auth/login -H 'Content-Type: application/json' -d '{"username":"testuser1","password":"Test123456"}'`);
  log('backend direct login:', r2.stdout.trim());

  // 经 Nginx 8088
  const r3 = await exec(`curl -s -w '\\nHTTP_CODE:%{http_code}' -X POST http://localhost:8088/api/auth/register -H 'Content-Type: application/json' -d '{"username":"testuser2","password":"Test123456","nickname":"Test2"}'`);
  log('nginx 8088 register:', r3.stdout.trim());

  const r4 = await exec(`curl -s -w '\\nHTTP_CODE:%{http_code}' -X POST http://localhost:8088/api/auth/login -H 'Content-Type: application/json' -d '{"username":"testuser2","password":"Test123456"}'`);
  log('nginx 8088 login:', r4.stdout.trim());

  // 看 Nginx 配置
  const r5 = await exec('cat /etc/nginx/conf.d/wetalk.conf');
  log('nginx conf:\n' + r5.stdout.trim());

  // 看后端日志最后几行
  const r6 = await exec('tail -30 /opt/wetalk/wetalk.log 2>/dev/null | grep -E "ERROR|WARN|FORBIDDEN|403|register|login" | tail -10');
  log('backend log:', r6.stdout.trim());

  conn.end();
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 30000 });
