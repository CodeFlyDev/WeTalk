import { Client } from 'ssh2';
const conn = new Client();
const log = (...a) => console.log(...a);
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

conn.on('ready', async () => {
  log('[OK] connected');

  // 1. 等所有容器就绪（最多 5 分钟）
  log('=== waiting for containers ===');
  for (let i = 0; i < 60; i++) {
    const r = await exec('docker ps --format "{{.Names}}" | grep -E "wetalk-(mysql|mongo|redis|es|minio)$" | wc -l');
    const count = parseInt(r.stdout.trim());
    log(`  wetalk containers running: ${count}/5`);
    if (count === 5) break;
    await sleep(5000);
  }

  const ps = await exec('docker ps --format "{{.Names}}\t{{.Status}}"');
  log('\n=== docker ps ===\n' + ps.stdout);

  // 2. 等待 MySQL 可用
  log('=== waiting for mysql ready ===');
  for (let i = 0; i < 30; i++) {
    const r = await exec('docker exec wetalk-mysql mysqladmin ping -h127.0.0.1 -uroot -pwetalk_root_2024 --silent 2>&1');
    if (r.stdout.includes('mysqld is alive') || r.code === 0) { log('  mysql ready'); break; }
    log(`  mysql waiting ${i}`);
    await sleep(3000);
  }

  // 3. 等待 ES 就绪
  log('=== waiting for es ready ===');
  for (let i = 0; i < 40; i++) {
    const r = await exec('curl -s http://localhost:9200/_cluster/health 2>&1');
    if (r.stdout.includes('"status"')) { log('  es ready: ' + r.stdout.substring(0, 100)); break; }
    log(`  es waiting ${i}`);
    await sleep(5000);
  }

  // 4. 启动后端（如果没在跑）
  log('=== starting backend ===');
  const backendRunning = await exec('pgrep -f "wetalk-app-0.1.0-SNAPSHOT.jar" | wc -l');
  if (parseInt(backendRunning.stdout.trim()) > 0) {
    log('  backend already running, restarting...');
    await exec('pkill -f "wetalk-app-0.1.0-SNAPSHOT.jar" 2>/dev/null');
    await sleep(2000);
  }
  // 直接用 start.sh
  const start = await exec('bash /opt/wetalk/start.sh 2>&1');
  log('  start.sh output: ' + start.stdout);

  // 5. 等待后端就绪
  log('=== waiting for backend ready ===');
  for (let i = 0; i < 60; i++) {
    const r = await exec('curl -s -o /dev/null -w "%{http_code}" http://localhost:8082/actuator/health 2>&1');
    log(`  backend check ${i}: ${r.stdout}`);
    if (r.stdout.includes('200') || r.stdout.includes('503')) { log('  backend up!'); break; }
    await sleep(5000);
  }

  // 6. 检查后端日志
  const blog = await exec('tail -30 /opt/wetalk/wetalk.log 2>&1');
  log('\n=== backend log ===\n' + blog.stdout);

  // 7. 配置 nginx
  log('=== configuring nginx ===');
  const nginxTest = await exec('nginx -t 2>&1');
  log('  nginx test: ' + nginxTest.stdout + nginxTest.stderr);
  if (nginxTest.code === 0) {
    const reload = await exec('systemctl reload nginx 2>&1 || nginx -s reload 2>&1');
    log('  nginx reload: ' + reload.stdout + reload.stderr);
  } else {
    log('  nginx not installed, installing...');
    const install = await exec('apt-get install -y nginx 2>&1 | tail -5');
    log('  install: ' + install.stdout);
    await exec('nginx -t && systemctl reload nginx 2>&1');
  }

  // 8. 最终验证
  log('=== final verification ===');
  const ext = await exec('curl -s -o /dev/null -w "%{http_code}" http://localhost/ 2>&1');
  log('  nginx (port 80): ' + ext.stdout);
  const api = await exec('curl -s -o /dev/null -w "%{http_code}" http://localhost/api/actuator/health 2>&1');
  log('  api via nginx: ' + api.stdout);
  const direct = await exec('curl -s http://localhost:8082/actuator/health 2>&1');
  log('  backend direct: ' + direct.stdout);

  log('\n=== DONE ===');
  conn.end();
}).on('error', e => { log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 15000 });
