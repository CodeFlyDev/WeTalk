import { Client } from 'ssh2';
const conn = new Client();
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
  // kill 旧拉取
  await exec('pkill -f "docker pull" 2>/dev/null; sleep 1; echo killed');

  // 加更多镜像源到 daemon.json
  await exec(`cat > /etc/docker/daemon.json << 'EOF'
{"registry-mirrors":["https://docker.m.daocloud.io","https://docker.1ms.run","https://docker.xuanyuan.me","https://dockerproxy.net"]}
EOF`);
  await exec('systemctl restart docker; sleep 3; echo docker_restarted');

  // 从多个源尝试拉取
  const sources = [
    'docker.m.daocloud.io/library/mongo:7',
    'docker.1ms.run/library/mongo:7',
    'docker.xuanyuan.me/library/mongo:7',
  ];
  for (const src of sources) {
    console.log(`\n=== trying: ${src} ===`);
    const r = await exec(`timeout 120 docker pull ${src} 2>&1`);
    console.log('code:', r.code);
    console.log((r.stdout + r.stderr).slice(-300));
    // 检查是否拉到了
    const check = await exec(`docker images --format "{{.Repository}}:{{.Tag}}" | grep mongo`);
    if (check.stdout.includes('mongo')) {
      console.log('SUCCESS! mongo image found:', check.stdout.trim());
      // 打 tag
      await exec(`docker tag ${src} mongo:7 && echo TAG_OK`);
      break;
    }
  }
  // 最终检查
  const final = await exec('docker images | grep mongo');
  console.log('\n=== final mongo images ===\n' + final.stdout);
  conn.end();
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 15000 });
