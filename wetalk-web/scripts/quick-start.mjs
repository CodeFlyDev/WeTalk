import { Client } from 'ssh2';
const conn = new Client();
const sleep = ms => new Promise(r => setTimeout(r, ms));
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
function uploadContent(content, remote) {
  return new Promise((resolve, reject) => {
    conn.sftp((e, sftp) => {
      if (e) return reject(e);
      const ws = sftp.createWriteStream(remote);
      ws.on('close', () => resolve());
      ws.on('error', reject);
      ws.end(Buffer.from(content));
    });
  });
}
conn.on('ready', async () => {
  console.log('[Q] quick start - mongo no auth + backend');

  // 1. 重启 mongod（无认证）
  console.log('restarting mongod (no auth)...');
  await exec('pkill -f mongod 2>/dev/null; sleep 2; rm -f /data/mongo/mongod.lock 2>/dev/null');
  const start = await exec('mongod --dbpath /data/mongo --port 27017 --bind_ip localhost --fork --logpath /data/mongo/mongod.log 2>&1');
  console.log('mongo start:', start.stdout.trim());

  // 2. 写后端启动脚本（mongo 无认证）
  console.log('\nwriting start.sh...');
  const START_SH = `#!/bin/bash
set -e
cd /opt/wetalk
for i in $(seq 1 30); do
  curl -s http://localhost:9200/minio/health/live >/dev/null 2>&1 && break
  sleep 2
done
pkill -f "wetalk-app-0.1.0-SNAPSHOT.jar" 2>/dev/null || true
sleep 2
nohup java -Xmx384m -Xms128m \\
  -jar /opt/wetalk/wetalk-app.jar \\
  --server.port=8082 \\
  --spring.cloud.nacos.discovery.enabled=false \\
  --spring.cloud.sentinel.enabled=false \\
  --spring.datasource.url="jdbc:mysql://localhost:3307/wetalk?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai" \\
  --spring.datasource.username="wetalk" --spring.datasource.password="wetalk_2024" \\
  --spring.data.mongodb.uri="mongodb://localhost:27017/wetalk" \\
  --spring.data.redis.host="localhost" --spring.data.redis.port=6380 --spring.data.redis.password="wetalk_redis_2024" \\
  --wetalk.jwt.secret="prod-jwt-secret-2024-change-me-32b!" \\
  --wetalk.minio.endpoint="http://localhost:9002" --wetalk.minio.access-key="wetalk-minio" --wetalk.minio.secret-key="wetalk_minio_2024" \\
  --spring.elasticsearch.uris="" \\
  --wetalk.rocketmq.enabled=false \\
  --spring.kafka.bootstrap-servers="" \\
  --spring.kafka.properties.max.block.ms=2000 \\
  > /opt/wetalk/wetalk.log 2>&1 &
echo "backend started, pid=$!"
`;
  await uploadContent(START_SH, '/opt/wetalk/start.sh');
  await exec('chmod +x /opt/wetalk/start.sh');

  // 3. 启动后端
  console.log('\nstarting backend...');
  const backendStart = await exec('bash /opt/wetalk/start.sh 2>&1');
  console.log(backendStart.stdout.trim());

  // 4. 等后端就绪（最多 3 分钟）
  console.log('\nwaiting for backend...');
  for (let i = 0; i < 40; i++) {
    const r = await exec('curl -s -o /dev/null -w "%{http_code}" http://localhost:8082/actuator/health 2>&1');
    const code = r.stdout.trim();
    console.log(`  [${i}] health: ${code}`);
    if (code.includes('200') || code.includes('503')) { console.log('BACKEND UP!'); break; }
    if (code === '000') {
      // 看看后端日志
      const log = await exec('tail -5 /opt/wetalk/wetalk.log 2>/dev/null || echo NO_LOG');
      if (i % 5 === 0) console.log('    log:', log.stdout.trim());
    }
    await sleep(5000);
  }

  // 5. 后端日志
  const blog = await exec('tail -30 /opt/wetalk/wetalk.log 2>/dev/null');
  console.log('\n=== backend log ===\n' + blog.stdout);

  // 6. 配置 nginx
  console.log('\n=== nginx ===');
  const nginxTest = await exec('nginx -t 2>&1');
  console.log('test:', nginxTest.stdout.trim(), nginxTest.stderr.trim());
  if (nginxTest.code === 0) {
    const reload = await exec('systemctl reload nginx 2>&1 || nginx -s reload 2>&1');
    console.log('reload:', reload.stdout.trim(), reload.stderr.trim());
  } else {
    console.log('installing nginx...');
    await exec('apt-get install -y nginx 2>&1 | tail -3');
    await exec(`cat > /etc/nginx/conf.d/wetalk.conf << 'EOF'
server {
    listen 80;
    server_name _;
    root /opt/wetalk/dist;
    index index.html;
    client_max_body_size 100m;
    location / { try_files $uri $uri/ /index.html; }
    location /api/ {
        proxy_pass http://127.0.0.1:8082;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    location /ws {
        proxy_pass http://127.0.0.1:8082;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
EOF`);
    await exec('nginx -t && systemctl start nginx && systemctl enable nginx');
  }

  // 7. 最终验证
  console.log('\n=== final ===');
  const ext = await exec('curl -s -o /dev/null -w "nginx_port80: %{http_code}\\n" http://localhost/ 2>&1');
  console.log(ext.stdout.trim());
  const api = await exec('curl -s -o /dev/null -w "api_via_nginx: %{http_code}\\n" http://localhost/api/actuator/health 2>&1');
  console.log(api.stdout.trim());
  const direct = await exec('curl -s http://localhost:8082/actuator/health 2>&1');
  console.log('backend direct:', direct.stdout.trim());

  // 8. 容器状态
  const ps = await exec('docker ps --format "{{.Names}}\t{{.Status}}" | grep wetalk');
  console.log('\n=== wetalk containers ===\n' + ps.stdout);

  // 9. mongod 状态
  const ms = await exec('pgrep -fa mongod');
  console.log('\nmongod:', ms.stdout.trim());

  // 10. curl 公网 IP
  const ip = await exec('curl -s ifconfig.me 2>&1');
  console.log('\nserver IP:', ip.stdout.trim());

  conn.end();
  console.log('\n=== DEPLOY COMPLETE ===');
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 15000 });
