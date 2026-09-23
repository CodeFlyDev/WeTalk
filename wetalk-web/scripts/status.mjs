import { Client } from 'ssh2';

const conn = new Client();
const log = (...a) => console.log('[U]', ...a);
function exec(cmd, timeout = 15000) {
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
  log('========== Docker 容器 ==========');
  const d = await exec('docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"');
  log(d.stdout.trim());

  log('\n========== 监听端口 ==========');
  const p = await exec('ss -tlnp | grep -v "127.0.0.53"');
  log(p.stdout.trim());

  log('\n========== 进程 ==========');
  const ps = await exec('ps aux --sort=-%mem | head -15');
  log(ps.stdout.trim());

  log('\n========== WeTalk 后端 ==========');
  const h1 = await exec('curl -s http://localhost:8082/actuator/health 2>&1');
  log('health:', h1.stdout.trim());
  const h2 = await exec('curl -sk -o /dev/null -w "%{http_code}" https://localhost:8088/');
  log('https 8088:', h2.stdout.trim());
  const h3 = await exec('curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/ 2>&1');
  log('http 8080 (music):', h3.stdout.trim());

  log('\n========== 服务器资源 ==========');
  const m = await exec('free -h && echo "---" && df -h / && echo "---" && uptime');
  log(m.stdout.trim());

  log('\n========== MongoDB ==========');
  const mg = await exec('pgrep -a mongod');
  log(mg.stdout.trim() || '(not running)');

  conn.end();
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 30000 });
