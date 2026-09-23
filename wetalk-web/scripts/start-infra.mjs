import { Client } from 'ssh2';
const conn = new Client();
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
conn.on('ready', async () => {
  console.log('[I] start infra containers (using cached images)');

  // 1. 先写精简版 compose（只用已有镜像，端口避开 music）
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
  redis-data:
  minio-data:
`;
  await exec(`cat > /opt/wetalk/docker-compose.yml << 'EOF'\n${COMPOSE}\nEOF`);
  console.log('compose written');

  // 2. 删除可能残留的旧容器
  await exec('docker rm -f wetalk-mysql wetalk-redis wetalk-minio wetalk-es wetalk-mongo 2>/dev/null; echo cleaned');

  // 3. 启动 compose（只用已有镜像，秒起）
  console.log('docker compose up -d ...');
  const up = await exec('cd /opt/wetalk && docker compose up -d 2>&1');
  console.log(up.stdout + up.stderr);

  // 4. 等 MySQL 就绪
  console.log('waiting for mysql...');
  for (let i = 0; i < 30; i++) {
    const r = await exec('docker exec wetalk-mysql mysqladmin ping -h127.0.0.1 -uroot -pwetalk_root_2024 --silent 2>&1');
    if (r.stdout.includes('mysqld is alive')) { console.log('mysql ready!'); break; }
    await new Promise(s => setTimeout(s, 3000));
  }

  // 5. 等 MinIO 就绪
  for (let i = 0; i < 15; i++) {
    const r = await exec('curl -s http://localhost:9002/minio/health/live 2>&1');
    if (r.stdout.includes('ok')) { console.log('minio ready!'); break; }
    await new Promise(s => setTimeout(s, 2000));
  }

  // 6. 最终状态
  const ps = await exec('docker ps --format "{{.Names}}\t{{.Status}}"');
  console.log('\n=== containers ===\n' + ps.stdout);

  conn.end();
  console.log('\nINFRA DONE');
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 15000 });
