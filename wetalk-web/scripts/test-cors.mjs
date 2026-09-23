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

  // 模拟浏览器从 103.217.186.134:8088 访问
  const r1 = await exec(`curl -s -w '\\nHTTP:%{http_code}' -X POST http://localhost:8088/api/auth/register -H 'Content-Type: application/json' -H 'Origin: http://103.217.186.134:8088' -d '{"username":"testuser3","password":"Test123456","nickname":"T3"}'`);
  log('with Origin header:', r1.stdout.trim());

  // OPTIONS 预检
  const r2 = await exec(`curl -s -w '\\nHTTP:%{http_code}' -X OPTIONS http://localhost:8088/api/auth/register -H 'Origin: http://103.217.186.134:8088' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: Content-Type'`);
  log('OPTIONS preflight:', r2.stdout.trim());

  // 检查 80 端口
  const r3 = await exec('curl -s -o /dev/null -w "%{http_code}" http://localhost/ 2>&1');
  log('port 80:', r3.stdout.trim());

  // 检查 Nginx 所有配置
  const r4 = await exec('ls /etc/nginx/conf.d/ /etc/nginx/sites-enabled/ 2>&1');
  log('nginx configs:', r4.stdout.trim());

  // 检查 80 端口被谁占
  const r5 = await exec('ss -tlnp | grep :80');
  log('port 80 owner:', r5.stdout.trim());

  conn.end();
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 30000 });
