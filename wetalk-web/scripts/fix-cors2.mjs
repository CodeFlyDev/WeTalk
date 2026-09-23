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

  // Nginx 配置：CORS 在 Nginx 层处理，后端不会收到 Origin
  const NGINX = `server {
    listen 8088; server_name _;
    root /opt/wetalk/dist; index index.html;
    client_max_body_size 100m;

    location / { try_files $uri $uri/ /index.html; }

    location /api/ {
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin $http_origin always;
            add_header Access-Control-Allow-Methods "GET,POST,PUT,DELETE,OPTIONS" always;
            add_header Access-Control-Allow-Headers "*" always;
            add_header Access-Control-Allow-Credentials "true" always;
            add_header Access-Control-Max-Age 3600 always;
            return 204;
        }
        proxy_pass http://127.0.0.1:8082;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Origin "";
        add_header Access-Control-Allow-Origin $http_origin always;
        add_header Access-Control-Allow-Credentials "true" always;
    }

    location /ws {
        proxy_pass http://127.0.0.1:8082;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Origin "";
        proxy_read_timeout 3600s;
    }
}`;

  await new Promise((res, rej) => {
    conn.sftp((e, s) => {
      if (e) return rej(e);
      const ws = s.createWriteStream('/etc/nginx/conf.d/wetalk.conf');
      ws.on('close', res); ws.on('error', rej);
      ws.end(Buffer.from(NGINX));
    });
  });
  log('nginx conf written');

  const t = await exec('nginx -t 2>&1');
  log('nginx -t:', t.code === 0 ? 'OK' : t.stderr.trim());

  if (t.code === 0) {
    await exec('systemctl reload nginx 2>&1');
    log('nginx reloaded');
  }

  // 测试
  const r1 = await exec(`curl -s -w '\\nHTTP:%{http_code}' -X POST http://localhost:8088/api/auth/register -H 'Content-Type: application/json' -H 'Origin: http://103.217.186.134:8088' -d '{"username":"testuser5","password":"Test123456","nickname":"T5"}'`);
  log('register:', r1.stdout.trim());

  const r2 = await exec(`curl -s -w '\\nHTTP:%{http_code}' -X OPTIONS http://localhost:8088/api/auth/register -H 'Origin: http://103.217.186.134:8088' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: Content-Type'`);
  log('OPTIONS:', r2.stdout.trim());

  const r3 = await exec(`curl -s -w '\\nHTTP:%{http_code}' -X POST http://localhost:8088/api/auth/login -H 'Content-Type: application/json' -H 'Origin: http://103.217.186.134:8088' -d '{"username":"testuser5","password":"Test123456"}'`);
  log('login:', r3.stdout.trim());

  conn.end();
  log('DONE');
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 30000 });
