const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();

const config = {
  host: '103.217.186.134',
  port: 22,
  username: 'root',
  password: 'Beingawaiter.495',
  readyTimeout: 30000,
};

const composeFile = `services:
  mysql:
    image: mysql:8.4
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
    image: mongo:7
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
    image: redis:7
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
    image: elasticsearch:8.14.3
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
    image: minio/minio:latest
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

const envFile = `MYSQL_ROOT_PASSWORD=wetalk_root_2024
MYSQL_PASSWORD=wetalk_2024
MONGO_ROOT_PASSWORD=root_mongo_2024
REDIS_PASSWORD=wetalk_redis_2024
MINIO_USER=wetalk-minio
MINIO_PASSWORD=wetalk_minio_2024
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
    }).on('error', (err) => {
      reject(err);
    }).connect(config);
  });

  try {
    // Step 1: Check current docker state
    await execSSH(conn, 'docker ps -a; echo "---"; docker images; echo "---"; sysctl vm.max_map_count', 'Step 1: 当前 Docker 状态');

    // Step 2 & 4: Create dir and write compose file
    await execSSH(conn, 'mkdir -p /opt/wetalk', 'Step 2: 创建工作目录');

    // Step 3: Set vm.max_map_count BEFORE starting ES
    await execSSH(conn, 'sysctl -w vm.max_map_count=262144; echo "vm.max_map_count=262144" >> /etc/sysctl.conf', 'Step 3: 设置 vm.max_map_count');

    // Step 4: Write compose file
    await writeFile(conn, '/opt/wetalk/docker-compose.yml', composeFile, 'Step 4: 写入 docker-compose.yml');

    // Step 5: Write .env file
    await writeFile(conn, '/opt/wetalk/.env', envFile, 'Step 5: 写入 .env 文件');

    // Verify files
    await execSSH(conn, 'ls -la /opt/wetalk/; echo "---"; cat /opt/wetalk/docker-compose.yml; echo "---ENV---"; cat /opt/wetalk/.env', '验证文件写入');

    // Step 6: docker compose up -d
    await execSSH(conn, 'cd /opt/wetalk && docker compose up -d', 'Step 6: docker compose up -d');

    // Poll for healthy status
    console.log('\n========== 等待所有容器健康 ==========\n');
    const maxAttempts = 30;
    let healthy = false;
    for (let i = 1; i <= maxAttempts; i++) {
      console.log(`\n--- Poll attempt ${i}/${maxAttempts} ---`);
      const result = await execSSH(conn, 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"', `轮询 ${i}`);
      // Check if all 5 containers are healthy or running (some don't have healthcheck)
      const psResult = await execSSH(conn, 'docker ps -a --format "{{.Names}} {{.Status}}"', `检查状态 ${i}`);
      const lines = psResult.stdout.trim().split('\n');
      let allOk = true;
      for (const line of lines) {
        // Container is OK if it contains "Up" (and optionally "healthy")
        if (!line.includes('Up')) {
          allOk = false;
          console.log(`  [NOT READY] ${line}`);
        } else {
          console.log(`  [OK] ${line}`);
        }
      }
      if (allOk && lines.length >= 5) {
        healthy = true;
        console.log('\n*** 所有容器已启动! ***');
        break;
      }
      // Wait 10s before next poll
      await new Promise(r => setTimeout(r, 10000));
    }

    if (!healthy) {
      console.log('\nWARNING: 部分容器可能未在预期时间内就绪');
    }

    // Final docker ps
    await execSSH(conn, 'docker ps -a; echo "==="; docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"', '最终 docker ps 输出');

  } catch (err) {
    console.error('\n[ERROR]', err.message || err);
  } finally {
    conn.end();
    console.log('\nSSH 连接已关闭');
  }
}

main();
