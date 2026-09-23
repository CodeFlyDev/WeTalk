import { Client } from 'ssh2';

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

  await exec('pkill -f "wetalk-app" 2>/dev/null; sleep 2; echo killed');

  const START_SH = `#!/bin/bash
set -e
cd /opt/wetalk
pkill -f "wetalk-app" 2>/dev/null || true
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
  --wetalk.cors.allowed-origins[0]="http://103.217.186.134:8088" \\
  --wetalk.cors.allowed-origins[1]="http://localhost:5173" \\
  --wetalk.cors.allowed-origins[2]="http://localhost:1420" \\
  --wetalk.cors.allowed-origins[3]="tauri://localhost" \\
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

  const r = await exec('bash /opt/wetalk/start.sh 2>&1');
  log(r.stdout.trim());

  log('waiting...');
  for (let i = 0; i < 30; i++) {
    const h = await exec('curl -s -o /dev/null -w "%{http_code}" http://localhost:8082/actuator/health 2>&1');
    if (h.stdout.trim() === '200') { log('BACKEND UP!'); break; }
    await sleep(5000);
  }

  // 测试 CORS
  const r1 = await exec(`curl -s -w '\\nHTTP:%{http_code}' -X POST http://localhost:8088/api/auth/register -H 'Content-Type: application/json' -H 'Origin: http://103.217.186.134:8088' -d '{"username":"testuser4","password":"Test123456","nickname":"T4"}'`);
  log('register with Origin:', r1.stdout.trim());

  const r2 = await exec(`curl -s -w '\\nHTTP:%{http_code}' -X OPTIONS http://localhost:8088/api/auth/register -H 'Origin: http://103.217.186.134:8088' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: Content-Type'`);
  log('OPTIONS preflight:', r2.stdout.trim());

  conn.end();
  log('DONE');
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 30000 });
