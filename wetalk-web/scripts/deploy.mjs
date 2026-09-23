// WeTalk 一键部署脚本：上传产物 + 启动基础设施 + 启动后端 + 配置 Nginx
import { Client } from 'ssh2';
import { readFileSync, statSync } from 'fs';
import { join } from 'path';

const HOST = '103.217.186.134';
const USER = 'root';
const PWD = 'Beingawaiter.495';
const PROJECT = 'e:/Github/WeTalk';

const conn = new Client();
const log = (...a) => console.log('[DEPLOY]', ...a);
const err = (...a) => console.error('[DEPLOY-ERR]', ...a);

function exec(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, opts, (e, stream) => {
      if (e) return reject(e);
      let out = '', errOut = '';
      stream.on('data', d => out += d.toString());
      stream.on('stderr', d => errOut += d.toString());
      stream.on('close', code => resolve({ code, stdout: out, stderr: errOut }));
    });
  });
}

function uploadFile(local, remote) {
  return new Promise((resolve, reject) => {
    conn.sftp((e, sftp) => {
      if (e) return reject(e);
      const size = statSync(local).size;
      let sent = 0;
      const rs = readFileSync(local);
      const ws = sftp.createWriteStream(remote);
      ws.on('close', () => resolve({ size: rs.length }));
      ws.on('error', reject);
      ws.end(rs);
    });
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// 极简 docker-compose：只跑 5 个核心服务
const COMPOSE = `name: wetalk
services:
  mysql:
    image: mysql:8.4
    container_name: wetalk-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: wetalk_root_2024
      MYSQL_DATABASE: wetalk
      MYSQL_USER: wetalk
      MYSQL_PASSWORD: wetalk_2024
      TZ: Asia/Shanghai
    command: ["--character-set-server=utf8mb4","--collation-server=utf8mb4_unicode_ci"]
    ports: ["3306:3306"]
    volumes: ["mysql-data:/var/lib/mysql"]
    healthcheck:
      test: ["CMD-SHELL","mysqladmin ping -h127.0.0.1 -uroot -p\\\"wetalk_root_2024\\\" --silent"]
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 30s
  mongo:
    image: mongo:7
    container_name: wetalk-mongo
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: root_mongo_2024
      MONGO_INITDB_DATABASE: wetalk
      TZ: Asia/Shanghai
    ports: ["27017:27017"]
    volumes: ["mongo-data:/data/db"]
    healthcheck:
      test: ["CMD","mongosh","--quiet","--eval","db.adminCommand('ping').ok"]
      interval: 10s
      timeout: 5s
      retries: 12
  redis:
    image: redis:7
    container_name: wetalk-redis
    restart: unless-stopped
    command: ["redis-server","--requirepass","wetalk_redis_2024","--appendonly","yes","--maxmemory","128mb","--maxmemory-policy","allkeys-lru"]
    ports: ["6379:6379"]
    volumes: ["redis-data:/data"]
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.14.3
    container_name: wetalk-es
    restart: unless-stopped
    environment:
      discovery.type: single-node
      xpack.security.enabled: "false"
      ES_JAVA_OPTS: "-Xms256m -Xmx256m"
    ports: ["9200:9200"]
    volumes: ["es-data:/usr/share/elasticsearch/data"]
  minio:
    image: minio/minio:RELEASE.2024-08-17T01-24-54Z
    container_name: wetalk-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: wetalk-minio
      MINIO_ROOT_PASSWORD: wetalk_minio_2024
    ports: ["9000:9000","9001:9001"]
    volumes: ["minio-data:/data"]
volumes:
  mysql-data:
  mongo-data:
  redis-data:
  es-data:
  minio-data:
`;

// 后端启动脚本
const START_SH = `#!/bin/bash
set -e
cd /opt/wetalk
# 等基础设施就绪
for i in $(seq 1 60); do
  docker exec wetalk-mysql mysqladmin ping -h127.0.0.1 -uroot -pwetalk_root_2024 --silent 2>/dev/null && break
  echo "wait mysql $i"; sleep 2
done
for i in $(seq 1 30); do
  curl -s http://localhost:9200/_cluster/health >/dev/null 2>&1 && break
  echo "wait es $i"; sleep 2
done
# 删旧进程
pkill -f "wetalk-app-0.1.0-SNAPSHOT.jar" 2>/dev/null || true
sleep 2
# 启动后端（8082 端口避开 Docker 占用的 8080）
nohup java -Xmx384m -Xms128m \\
  -jar /opt/wetalk/wetalk-app.jar \\
  --server.port=8082 \\
  --spring.cloud.nacos.discovery.enabled=false \\
  --spring.cloud.sentinel.enabled=false \\
  --spring.datasource.url="jdbc:mysql://localhost:3306/wetalk?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai" \\
  --spring.datasource.username="wetalk" --spring.datasource.password="wetalk_2024" \\
  --spring.data.mongodb.uri="mongodb://root:root_mongo_2024@localhost:27017/wetalk?authSource=admin" \\
  --spring.data.redis.host="localhost" --spring.data.redis.password="wetalk_redis_2024" \\
  --wetalk.jwt.secret="prod-jwt-secret-2024-change-me-32b!" \\
  --wetalk.minio.endpoint="http://localhost:9000" --wetalk.minio.access-key="wetalk-minio" --wetalk.minio.secret-key="wetalk_minio_2024" \\
  --spring.elasticsearch.uris="http://localhost:9200" \\
  --wetalk.rocketmq.enabled=false \\
  --spring.kafka.bootstrap-servers="" \\
  --spring.kafka.properties.max.block.ms=2000 \\
  > /opt/wetalk/wetalk.log 2>&1 &
echo "backend started, pid=$!"
`;

// Nginx 配置：前端静态 + 反代后端
const NGINX_CONF = `server {
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
}`;

const run = async () => {
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject)
       .connect({ host: HOST, port: 22, username: USER, password: PWD, readyTimeout: 30000 });
  });
  log('SSH connected');

  // 1. 准备目录
  log('step1: mkdir');
  await exec('mkdir -p /opt/wetalk /opt/wetalk/logs');

  // 2. 写 docker-compose.yml
  log('step2: write compose');
  const c = await exec(`cat > /opt/wetalk/docker-compose.yml << 'COMPOSEEOF'\n${COMPOSE}\nCOMPOSEEOF`);
  log('compose written', c.stderr || 'ok');

  // 3. 写启动脚本
  log('step3: write start.sh');
  await exec(`cat > /opt/wetalk/start.sh << 'STARTEOF'\n${START_SH}\nSTARTEOF\nchmod +x /opt/wetalk/start.sh`);

  // 4. 写 nginx 配置
  log('step4: write nginx conf');
  await exec(`cat > /etc/nginx/conf.d/wetalk.conf << 'NGINXEOF'\n${NGINX_CONF}\nNGINXEOF`);

  // 5. 上传后端 jar
  log('step5: upload jar (this may take a while)');
  const jarLocal = join(PROJECT, 'wetalk-server/wetalk-app/target/wetalk-app-0.1.0-SNAPSHOT.jar');
  const jarSize = statSync(jarLocal).size;
  log(`jar size: ${(jarSize/1024/1024).toFixed(1)}MB`);
  await uploadFile(jarLocal, '/opt/wetalk/wetalk-app.jar');
  log('jar uploaded');

  // 6. 上传前端 dist
  log('step6: upload dist');
  // 打包 dist 为 tar.gz 上传，服务器解压
  const { execSync } = await import('child_process');
  const tarPath = 'e:/Github/WeTalk/wetalk-web/dist.tar.gz';
  try { execSync(`tar -czf ${tarPath} -C e:/Github/WeTalk/wetalk-web dist`, { shell: 'bash' }); } catch(e) {
    // 没有 tar，用 7z 或者直接传整个目录
    log('no tar, uploading individual files');
  }
  // 简化：直接打包上传
  const fs = await import('fs');
  if (fs.existsSync(tarPath)) {
    log('uploading dist.tar.gz');
    await uploadFile(tarPath, '/opt/wetalk/dist.tar.gz');
    await exec('cd /opt/wetalk && tar -xzf dist.tar.gz && rm dist.tar.gz');
    log('dist extracted');
  } else {
    // 逐文件上传（dist 通常不大）
    const files = ['index.html'];
    const assetsDir = join(PROJECT, 'wetalk-web/dist/assets');
    const assets = fs.readdirSync(assetsDir);
    await exec('mkdir -p /opt/wetalk/dist/assets');
    for (const f of files) {
      await uploadFile(join(PROJECT, 'wetalk-web/dist', f), `/opt/wetalk/dist/${f}`);
    }
    for (const f of assets) {
      await uploadFile(join(assetsDir, f), `/opt/wetalk/dist/assets/${f}`);
    }
    log('dist uploaded file by file');
  }

  // 7. 设置 ES 内核参数 + 启动基础设施
  log('step7: sysctl + docker compose up');
  await exec('sysctl -w vm.max_map_count=262144 2>&1');
  await exec('echo "vm.max_map_count=262144" >> /etc/sysctl.conf 2>&1 || true');
  const up = await exec('cd /opt/wetalk && docker compose up -d 2>&1');
  log('compose up:', up.stdout);

  // 8. 等待基础设施就绪
  log('step8: wait for infra');
  for (let i = 0; i < 60; i++) {
    const r = await exec('docker exec wetalk-mysql mysqladmin ping -h127.0.0.1 -uroot -pwetalk_root_2024 --silent 2>&1 || echo fail');
    if (r.stdout.includes('mysqld is alive')) { log('mysql ready'); break; }
    await sleep(3000);
  }
  for (let i = 0; i < 40; i++) {
    const r = await exec('curl -s http://localhost:9200/_cluster/health 2>&1 || echo fail');
    if (r.stdout.includes('"status"')) { log('es ready'); break; }
    await sleep(3000);
  }

  // 9. 启动后端
  log('step9: start backend');
  await exec('bash /opt/wetalk/start.sh');
  await sleep(5000);

  // 10. 重载 nginx
  log('step10: nginx reload');
  const nginxTest = await exec('nginx -t 2>&1');
  log('nginx test:', nginxTest.stdout);
  if (nginxTest.code === 0) {
    await exec('systemctl reload nginx 2>&1 || nginx -s reload 2>&1');
    log('nginx reloaded');
  } else {
    log('nginx test failed, trying install');
    await exec('apt-get install -y nginx 2>&1 | tail -3');
    await exec('nginx -t && systemctl reload nginx');
  }

  // 11. 等待后端启动
  log('step11: wait backend');
  for (let i = 0; i < 60; i++) {
    const r = await exec('curl -s -o /dev/null -w "%{http_code}" http://localhost:8082/actuator/health 2>&1');
    if (r.stdout.includes('200') || r.stdout.includes('503')) {
      log('backend up:', r.stdout);
      break;
    }
    log(`backend waiting ${i}...`);
    await sleep(5000);
  }

  // 12. 最终状态
  log('step12: final status');
  const ps = await exec('docker ps --format "{{.Names}} {{.Status}}"');
  log('containers:', ps.stdout);
  const backendLog = await exec('tail -20 /opt/wetalk/wetalk.log');
  log('backend log tail:', backendLog.stdout);

  const ext = await exec('curl -s -o /dev/null -w "%{http_code}" http://localhost:80/api/actuator/health 2>&1');
  log('external check:', ext.stdout);

  conn.end();
  log('DONE');
};

run().catch(e => { err(e.message); conn.end(); process.exit(1); });
