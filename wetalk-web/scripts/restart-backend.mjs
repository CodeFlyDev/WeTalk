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
  console.log('[R] restart backend with ES excluded');

  // 1. 杀旧后端
  await exec('pkill -f "wetalk-app-0.1.0-SNAPSHOT.jar" 2>/dev/null; sleep 2; echo killed');

  // 2. 重写 start.sh（加 spring.autoconfigure.exclude 禁用 ES）
  const START_SH = `#!/bin/bash
set -e
cd /opt/wetalk
pkill -f "wetalk-app" 2>/dev/null || true
sleep 2
nohup java -Xmx384m -Xms128m \\
  -jar /opt/wetalk/wetalk-app.jar \\
  --server.port=8082 \\
  --spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.elasticsearch.ElasticsearchAutoConfiguration,org.springframework.boot.autoconfigure.data.elasticsearch.ElasticsearchDataAutoConfiguration,org.springframework.boot.autoconfigure.data.elasticsearch.ElasticsearchRepositoriesAutoConfiguration \\
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
  await uploadContent(START_SH, '/opt/wetalk/start.sh');
  await exec('chmod +x /opt/wetalk/start.sh');
  console.log('start.sh updated');

  // 3. 启动
  const r = await exec('bash /opt/wetalk/start.sh 2>&1');
  console.log(r.stdout.trim());

  // 4. 等后端（最多 4 分钟）
  console.log('waiting...');
  for (let i = 0; i < 50; i++) {
    const h = await exec('curl -s -o /dev/null -w "%{http_code}" http://localhost:8082/actuator/health 2>&1');
    const code = h.stdout.trim();
    console.log(`  [${i}] health: ${code}`);
    if (code.includes('200') || code.includes('503')) { console.log('BACKEND UP!'); break; }
    if (code === '000' && i % 5 === 0) {
      const log = await exec('tail -3 /opt/wetalk/wetalk.log');
      console.log('    log:', log.stdout.trim());
    }
    await sleep(5000);
  }

  // 5. 状态
  const tail = await exec('tail -20 /opt/wetalk/wetalk.log');
  console.log('\n=== tail ===\n' + tail.stdout);

  conn.end();
  console.log('\nDONE');
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 15000 });
