import { Client } from 'ssh2';
const conn = new Client();
const log = (...a) => console.log('[R]', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
function exec(cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (e, stream) => {
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

// 精简版 compose：去掉 ES，复用已有 mysql:8.0 和 redis:7，端口避开 music
const COMPOSE = `name: wetalk
services:
  mysql:
    image: mysql:8.0
    container_name: wetalk-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: wetalk_root_2024
      MYSQL_DATABASE: wetalk
      MYSQL_USER: wetalk
      MYSQL_PASSWORD: wetalk_2024
      TZ: Asia/Shanghai
    command: ["--character-set-server=utf8mb4","--collation-server=utf8mb4_unicode_ci"]
    ports: ["3307:3306"]
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
    ports: ["6380:6379"]
    volumes: ["redis-data:/data"]
  minio:
    image: minio/minio:RELEASE.2024-08-17T01-24-54Z
    container_name: wetalk-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: wetalk-minio
      MINIO_ROOT_PASSWORD: wetalk_minio_2024
    ports: ["9002:9000","9003:9001"]
    volumes: ["minio-data:/data"]
volumes:
  mysql-data:
  mongo-data:
  redis-data:
  minio-data:
`;

// 后端启动脚本：禁用 ES/RocketMQ/Kafka，端口用 3307/6380/9002
const START_SH = `#!/bin/bash
set -e
cd /opt/wetalk
for i in $(seq 1 60); do
  docker exec wetalk-mysql mysqladmin ping -h127.0.0.1 -uroot -pwetalk_root_2024 --silent 2>/dev/null && break
  echo "wait mysql $i"; sleep 2
done
for i in $(seq 1 30); do
  docker exec wetalk-mongo mongosh --quiet --eval "db.adminCommand('ping').ok" 2>/dev/null | grep -q 1 && break
  echo "wait mongo $i"; sleep 2
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
  --spring.data.mongodb.uri="mongodb://root:root_mongo_2024@localhost:27017/wetalk?authSource=admin" \\
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

conn.on('ready', async () => {
  log('connected');
  // 1. kill 旧的 docker compose up
  log('killing old compose up...');
  await exec('pkill -f "docker compose up" 2>/dev/null; pkill -f "docker-compose" 2>/dev/null; sleep 2; echo killed');
  // 删除可能创建的半成品容器
  await exec('docker rm -f wetalk-mysql wetalk-mongo wetalk-redis wetalk-es wetalk-minio 2>/dev/null; echo cleaned');

  // 2. 写新 compose
  log('writing new compose...');
  await uploadContent(COMPOSE, '/opt/wetalk/docker-compose.yml');
  log('compose written');

  // 3. 写新 start.sh
  log('writing start.sh...');
  await uploadContent(START_SH, '/opt/wetalk/start.sh');
  await exec('chmod +x /opt/wetalk/start.sh');
  log('start.sh written');

  // 4. 启动 docker compose（后台）
  log('starting docker compose up -d ...');
  const up = await exec('cd /opt/wetalk && docker compose up -d 2>&1');
  log('compose up output:\n' + up.stdout + up.stderr);

  // 5. 等容器就绪
  log('waiting for containers...');
  for (let i = 0; i < 40; i++) {
    const r = await exec('docker ps --format "{{.Names}}" | grep -E "wetalk-(mysql|mongo|redis|minio)$" | wc -l');
    const count = parseInt(r.stdout.trim());
    log(`  containers ${count}/4`);
    if (count === 4) break;
    await sleep(5000);
  }
  const ps = await exec('docker ps --format "{{.Names}}\t{{.Status}}" | grep wetalk');
  log('containers:\n' + ps.stdout);

  conn.end();
  log('PHASE1 DONE');
}).on('error', e => { log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 15000 });
