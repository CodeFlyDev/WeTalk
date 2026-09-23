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

conn.on('ready', async () => {
  log('connected');

  // 写新 Nginx 配置，listen 8088
  const NGINX = `server {
    listen 8088; server_name _;
    root /opt/wetalk/dist; index index.html;
    client_max_body_size 100m;
    location / { try_files $uri $uri/ /index.html; }
    location /api/ { proxy_pass http://127.0.0.1:8082; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    location /ws { proxy_pass http://127.0.0.1:8082; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_read_timeout 3600s; }
}`;

  await new Promise((res, rej) => {
    conn.sftp((e, s) => {
      if (e) return rej(e);
      const ws = s.createWriteStream('/etc/nginx/conf.d/wetalk.conf');
      ws.on('close', res); ws.on('error', rej);
      ws.end(Buffer.from(NGINX));
    });
  });
  log('wetalk.conf written (listen 8088)');

  // 删除默认站点（如果存在），避免抢占 80
  await exec('rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf 2>/dev/null; echo done');

  const t = await exec('nginx -t 2>&1');
  log('nginx -t:', t.code === 0 ? 'OK' : 'FAIL\n' + t.stderr);

  if (t.code === 0) {
    const r = await exec('systemctl reload nginx 2>&1 || nginx -s reload 2>&1');
    log('reload:', r.code === 0 ? 'OK' : r.stderr.trim());

    // 验证
    const h = await exec('curl -s -o /dev/null -w "%{http_code}" http://localhost:8088/');
    log('curl localhost:8088 =>', h.stdout.trim());

    const ip = await exec('curl -s ifconfig.me 2>&1');
    log('\n访问地址: http://' + ip.stdout.trim() + ':8088/');
  }

  conn.end();
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 30000 });
