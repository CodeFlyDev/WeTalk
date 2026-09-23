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
  const NGINX = `server {
    listen 8088 ssl; server_name _;
    ssl_certificate /etc/nginx/ssl/wetalk.crt;
    ssl_certificate_key /etc/nginx/ssl/wetalk.key;
    root /opt/wetalk/dist; index index.html;
    client_max_body_size 100m;
    error_page 497 =301 https://$host:$server_port$request_uri;

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
    conn.sftp((e, sftp) => {
      if (e) return rej(e);
      const ws = sftp.createWriteStream('/etc/nginx/conf.d/wetalk.conf');
      ws.on('close', res); ws.on('error', rej);
      ws.end(Buffer.from(NGINX));
    });
  });
  log('conf written (with 497 redirect)');

  const t = await exec('nginx -t 2>&1');
  log('nginx -t:', t.code === 0 ? 'OK' : t.stderr.trim());

  if (t.code === 0) {
    await exec('systemctl reload nginx 2>&1');
    log('reloaded');

    // 测 HTTPS
    const h = await exec('curl -sk -o /dev/null -w "%{http_code}" https://localhost:8088/');
    log('https =>', h.stdout.trim());

    // 测 HTTP (应该 301 redirect)
    const r = await exec('curl -s -o /dev/null -w "%{http_code}" http://localhost:8088/ 2>&1');
    log('http =>', r.stdout.trim(), '(should be 301)');
  }

  conn.end();
  log('DONE');
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 30000 });
