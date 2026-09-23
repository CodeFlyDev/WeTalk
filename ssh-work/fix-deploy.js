const { Client } = require('ssh2');

const conn = new Client();

const config = {
  host: '103.217.186.134',
  port: 22,
  username: 'root',
  password: 'Beingawaiter.495',
  readyTimeout: 30000,
};

// Use daocloud mirror prefix for all images
const composeFile = `services:
  mysql:
    image: docker.m.daocloud.io/library/mysql:8.4
    container_name: wetalk-mysql
    restart: unless-stopped
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: \${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: wetalk
      MYSQL_USER: wetalk
      MYSQL_PASSWORD: \${MYSQL_PASSWORD}
    volumes:
      - mysql-data:/var/lib/mysql

  mongodb:
    image: docker.m.daocloud.io/library/mongo:7
    container_name: wetalk-mongodb
    restart: unless-stopped
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: \${MONGO_ROOT_PASSWORD}
      MONGO_INITDB_DATABASE: wetalk
    volumes:
      - mongo-data:/data/db

  redis:
    image: docker.m.daocloud.io/library/redis:7
    container_name: wetalk-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    command: >
      redis-server
      --requirepass \${REDIS_PASSWORD}
      --appendonly yes
      --maxmemory 128mb
      --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data

  elasticsearch:
    image: docker.m.daocloud.io/library/elasticsearch:8.14.3
    container_name: wetalk-es
    restart: unless-stopped
    ports:
      - "9200:9200"
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - ES_JAVA_OPTS=-Xms256m -Xmx256m
    volumes:
      - es-data:/usr/share/elasticsearch/data

  minio:
    image: docker.m.daocloud.io/minio/minio:latest
    container_name: wetalk-minio
    restart: unless-stopped
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: \${MINIO_USER}
      MINIO_ROOT_PASSWORD: \${MINIO_PASSWORD}
    command: server /data --console-address ":9001"
    volumes:
      - minio-data:/data

volumes:
  mysql-data:
  mongo-data:
  redis-data:
  es-data:
  minio-data:
`;

function execSSH(conn, cmd, desc) {
  return new Promise((resolve, reject) => {
    console.log(`\n========== ${desc} ==========`);
    console.log(`> ${cmd}\n`);
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code, signal) => {
        console.log(`[Exit code: ${code}]`);
        resolve({ stdout, stderr, code });
      }).on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data.toString());
      }).stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data.toString());
      });
    });
  });
}

function writeFile(conn, remotePath, content, desc) {
  return new Promise((resolve, reject) => {
    console.log(`\n========== ${desc} ==========`);
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      const buf = Buffer.from(content, 'utf8');
      sftp.writeFile(remotePath, buf, (err) => {
        if (err) { sftp.end(); return reject(err); }
        console.log(`Written ${buf.length} bytes to ${remotePath}`);
        sftp.end();
        resolve();
      });
    });
  });
}

async function main() {
  await new Promise((resolve, reject) => {
    conn.on('ready', () => {
      console.log('SSH connection established.');
      resolve();
    }).on('error', (err) => { reject(err); }).connect(config);
  });

  try {
    // First check docker info for registry mirrors
    await execSSH(conn, 'docker info 2>&1 | grep -A5 "Registry Mirrors"', '查看 Docker Registry Mirror 配置');

    // Check if daocloud mirror prefix works for minio
    await execSSH(conn, 'docker pull docker.m.daocloud.io/minio/minio:latest 2>&1', '测试拉取 minio (daocloud mirror)');

    // Write updated compose file with mirror prefixes
    await writeFile(conn, '/opt/wetalk/docker-compose.yml', composeFile, '写入带镜像加速器的 docker-compose.yml');

    // Verify file
    await execSSH(conn, 'cat /opt/wetalk/docker-compose.yml | head -20', '验证 compose 文件前 20 行');

    // Run docker compose up -d
    await execSSH(conn, 'cd /opt/wetalk && docker compose up -d', 'docker compose up -d');

    // Poll for containers
    console.log('\n========== 等待所有容器启动 ==========\n');
    const maxAttempts = 40;
    let allOk = false;
    for (let i = 1; i <= maxAttempts; i++) {
      const result = await execSSH(conn, 'docker ps -a --format "{{.Names}} {{.Status}}"', `轮询 ${i}`);
      const lines = result.stdout.trim().split('\n').filter(l => l.length > 0);
      let okCount = 0;
      for (const line of lines) {
        if (line.includes('wetalk-')) {
          if (line.includes('Up')) {
            console.log(`  [UP] ${line}`);
            okCount++;
          } else if (line.includes('Exited') || line.includes('Created')) {
            console.log(`  [NOT READY] ${line}`);
          } else {
            console.log(`  [?] ${line}`);
          }
        }
      }
      // Count wetalk containers
      const wetalkLines = lines.filter(l => l.includes('wetalk-'));
      const upWetalk = wetalkLines.filter(l => l.includes('Up'));
      console.log(`  Wetalk containers: ${upWetalk.length}/${wetalkLines.length} up`);

      if (upWetalk.length >= 5) {
        allOk = true;
        console.log('\n*** 所有 5 个 wetalk 容器已启动! ***');
        break;
      }
      if (wetalkLines.length >= 5 && upWetalk.length < 5) {
        // Some containers exist but not all up
      }
      await new Promise(r => setTimeout(r, 10000));
    }

    // Final docker ps
    await execSSH(conn, 'docker ps -a', '最终 docker ps -a');
    await execSSH(conn, 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"', '最终 docker ps (表格)');

    // Test health
    console.log('\n========== 健康检查 ==========\n');
    await execSSH(conn, 'curl -s http://localhost:9200 2>&1 || echo "ES not ready"', 'ES 健康检查');
    await execSSH(conn, 'docker exec wetalk-redis redis-cli -a wetalk_redis_2024 ping 2>&1', 'Redis 健康检查');
    await execSSH(conn, 'docker exec wetalk-mysql mysql -uwetalk -pwetalk_2024 -e "SELECT 1;" wetalk 2>&1', 'MySQL 健康检查');
    await execSSH(conn, 'docker exec wetalk-mongodb mongosh -u root -p root_mongo_2024 --eval "db.runCommand({ping:1})" wetalk 2>&1', 'MongoDB 健康检查');
    await execSSH(conn, 'curl -s http://localhost:9000/minio/health/live 2>&1 && echo "MinIO OK" || echo "MinIO not ready"', 'MinIO 健康检查');

  } catch (err) {
    console.error('\n[ERROR]', err.message || err);
  } finally {
    conn.end();
    console.log('\nSSH 连接已关闭');
  }
}

main();
