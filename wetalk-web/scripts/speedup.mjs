import { Client } from 'ssh2';
const conn = new Client();
const log = (...a) => console.log('[S]', ...a);
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
  log('=== 1. kill stuck compose ===');
  await exec('pkill -f "docker compose" 2>/dev/null; sleep 1; echo done');

  log('=== 2. check/config docker mirror ===');
  const daemon = await exec('cat /etc/docker/daemon.json 2>/dev/null || echo "NO_CONFIG"');
  log('current daemon.json:', daemon.stdout.trim());
  if (daemon.stdout.includes('NO_CONFIG') || !daemon.stdout.includes('registry-mirrors')) {
    log('adding mirror config...');
    await exec('mkdir -p /etc/docker');
    await exec(`cat > /etc/docker/daemon.json << 'EOF'
{"registry-mirrors":["https://docker.m.daocloud.io","https://docker.1ms.run","https://docker.xuanyuan.me"]}
EOF`);
    log('restarting docker daemon...');
    await exec('systemctl daemon-reload; systemctl restart docker; sleep 3; echo docker_restarted');
  } else {
    log('mirror already configured');
  }

  log('=== 3. pull mongo:7 from mirror ===');
  const pull = await exec('docker pull docker.m.daocloud.io/library/mongo:7 2>&1');
  log('pull result:\n' + pull.stdout.slice(-500));

  log('=== 4. retag mongo ===');
  const tag = await exec('docker tag docker.m.daocloud.io/library/mongo:7 mongo:7 && echo TAG_OK');
  log(tag.stdout.trim());

  log('=== 5. docker compose up -d ===');
  const up = await exec('cd /opt/wetalk && docker compose up -d 2>&1');
  log('compose up:\n' + up.stdout + up.stderr);

  log('=== 6. docker ps ===');
  const ps = await exec('docker ps --format "{{.Names}}\t{{.Status}}"');
  log(ps.stdout);

  conn.end();
  log('DONE');
}).on('error', e => { log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 15000 });
