import { Client } from 'ssh2';
const conn = new Client();
const log = (...a) => console.log(...a);
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
  const checks = [
    ['docker ps --format "{{.Names}}\t{{.Status}}"', 'containers'],
    ['docker images --format "{{.Repository}}:{{.Tag}}\t{{.Size}}" | grep -E "mysql|mongo|redis|elastic|minio"', 'images'],
    ['docker pull --help 2>&1 | head -1; echo "---"'],
    ['ls -la /opt/wetalk/', 'opt/wetalk'],
    ['cat /opt/wetalk/docker-compose.yml | head -5', 'compose head'],
    ['curl -s -o /dev/null -w "%{http_code}" http://localhost:8082/actuator/health 2>&1', 'backend'],
    ['curl -s -o /dev/null -w "%{http_code}" http://localhost/ 2>&1', 'nginx'],
    ['tail -30 /opt/wetalk/wetalk.log 2>&1 || echo "no backend log"', 'backend log'],
    ['docker compose -f /opt/wetalk/docker-compose.yml ps 2>&1', 'compose ps'],
  ];
  for (const [cmd, label] of checks) {
    try {
      const r = await exec(cmd);
      log(`\n=== ${label} ===\n${r.stdout || r.stderr}`);
    } catch (e) {
      log(`\n=== ${label} ===\nERR: ${e.message}`);
    }
  }
  conn.end();
}).on('error', e => { log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 15000 });
