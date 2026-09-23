import { Client } from 'ssh2';
import { readFileSync, statSync } from 'fs';

const conn = new Client();
const log = (...a) => console.log('[U]', ...a);
function exec(cmd, timeout = 60000) {
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
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

conn.on('ready', async () => {
  log('connected');

  // 1. 杀后端
  await exec('pkill -f "wetalk-app" 2>/dev/null; sleep 2; echo killed');

  // 2. 上传新 jar
  const jarPath = 'e:/Github/WeTalk/wetalk-server/wetalk-app/target/wetalk-app-0.1.0-SNAPSHOT.jar';
  const size = statSync(jarPath).size;
  log(`uploading jar: ${(size/1024/1024).toFixed(1)}MB`);
  const data = readFileSync(jarPath);
  await new Promise((resolve, reject) => {
    conn.sftp((e, sftp) => {
      if (e) return reject(e);
      const ws = sftp.createWriteStream('/opt/wetalk/wetalk-app.jar');
      ws.on('close', resolve);
      ws.on('error', reject);
      ws.end(data);
    });
  });
  log('jar uploaded');

  // 3. 写 start.sh（用 wetalk.es.enabled=false）
  const START_SH = `#!/bin/bash
set -e
cd /opt/wetalk
pkill -f "wetalk-app" 2>/dev/null || true
sleep 2
nohup java -Xmx384m -Xms128m \\
  -jar /opt/wetalk/wetalk-app.jar \\
  --server.port=8082 \\
  --wetalk.es.enabled=false \\
  --spring.cloud.nacos.discovery.enabled=false \\
  --spring.cloud.sentinel.enabled=false \\
  --spring.datasource.url="jdbc:mysql://localhost:3307/wetalk?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai" \\
  --spring.datasource.username="wetalk" --spring.datasource.password="wetalk_2024" \\
  --spring.data.mongodb.uri="mongodb://localhost:27017/wetalk" \\
  --spring.data.redis.host="localhost" --spring.data.redis.port=6380 --spring.data.redis.password="wetalk_redis_2024" \\
  --wetalk.jwt.secret="prod-jwt-secret-2024-change-me-32b!" \\
  --wetalk.minio.endpoint="http://localhost:9002" --wetalk.minio.access-key="wetalk-minio" --wetalk.minio.secret-key="wetalk_minio_2024" \\
  --wetalk.rocketmq.enabled=false \\
  --spring.kafka.bootstrap-servers="" \\
  --spring.kafka.properties.max.block.ms=2000 \\
  > /opt/wetalk/wetalk.log 2>&1 &
echo "backend started, pid=$!"
`;
  await new Promise((resolve, reject) => {
    conn.sftp((e, sftp) => {
      if (e) return reject(e);
      const ws = sftp.createWriteStream('/opt/wetalk/start.sh');
      ws.on('close', () => { exec('chmod +x /opt/wetalk/start.sh'); resolve(); });
      ws.on('error', reject);
      ws.end(Buffer.from(START_SH));
    });
  });

  // 4. 启动
  const r = await exec('bash /opt/wetalk/start.sh 2>&1');
  log(r.stdout.trim());

  // 5. 等后端
  log('waiting...');
  for (let i = 0; i < 60; i++) {
    const h = await exec('curl -s -o /dev/null -w "%{http_code}" http://localhost:8082/actuator/health 2>&1');
    const code = h.stdout.trim();
    log(`  [${i}] health: ${code}`);
    if (code.includes('200') || code.includes('503')) { log('BACKEND UP!'); break; }
    if (code === '000' && i % 5 === 0) {
      const err = await exec('tail -5 /opt/wetalk/wetalk.log 2>/dev/null | grep -E "ERROR|Caused|Exception" | head -3');
      if (err.stdout.trim()) log('    ERR:', err.stdout.trim());
    }
    await sleep(5000);
  }

  // 6. Nginx
  log('\n=== nginx ===');
  const nginxTest = await exec('nginx -t 2>&1');
  if (nginxTest.code === 0) {
    await exec('systemctl reload nginx 2>&1 || nginx -s reload 2>&1');
    log('nginx reloaded');
  } else {
    await exec('apt-get install -y nginx 2>&1 | tail -2');
    const NGINX = `server {
    listen 80; server_name _;
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
    await exec('nginx -t 2>&1 && (systemctl start nginx 2>&1 || nginx 2>&1) && echo NGINX_OK');
  }

  // 7. 最终验证
  log('\n=== final ===');
  const ng = await exec('curl -s -o /dev/null -w "nginx_port80: %{http_code}\\n" http://localhost/');
  log(ng.stdout.trim());
  const ap = await exec('curl -s -o /dev/null -w "api_via_nginx: %{http_code}\\n" http://localhost/api/actuator/health');
  log(ap.stdout.trim());
  const di = await exec('curl -s http://localhost:8082/actuator/health 2>&1');
  log('backend:', di.stdout.trim());
  const ip = await exec('curl -s ifconfig.me 2>&1');
  log('server IP:', ip.stdout.trim());

  // 8. 容器状态
  const ps = await exec('docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "wetalk|NAME"');
  log('\ncontainers:\n' + ps.stdout.trim());

  conn.end();
  log('\n=== DEPLOY COMPLETE ===');
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 30000 });
