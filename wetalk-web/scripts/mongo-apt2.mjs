import { Client } from 'ssh2';
const conn = new Client();
function exec(cmd, timeout = 180000) {
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
  console.log('[A2] install mongodb via aliyun mirror...');

  // 1. 装依赖
  await exec('apt-get install -y gnupg curl 2>&1 | tail -3');

  // 2. 加 MongoDB GPG key
  console.log('adding mongo gpg key...');
  await exec('curl -fsSL https://pgp.mongodb.com/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg 2>&1');

  // 3. 用阿里云镜像替代官方源
  console.log('adding aliyun mongo mirror...');
  await exec('echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://mirrors.aliyun.com/mongodb/apt/ubuntu jammy/mongodb-org/7.0 multiverse" > /etc/apt/sources.list.d/mongodb-org-7.0.list');

  // 4. update
  console.log('apt-get update...');
  const upd = await exec('apt-get update 2>&1 | tail -10');
  console.log(upd.stdout);

  // 5. install
  console.log('installing mongodb-org...');
  const inst = await exec('apt-get install -y mongodb-org 2>&1 | tail -15; echo EXIT=$?', 300000);
  console.log(inst.stdout.slice(-1000));

  // 6. 检查
  const which = await exec('which mongod 2>&1; mongod --version 2>&1 | head -2');
  console.log('\n=== check ===\n' + which.stdout);

  if (which.stdout.includes('mongod')) {
    console.log('\n=== start mongod ===');
    await exec('mkdir -p /data/mongo');
    await exec('pkill -f mongod 2>/dev/null; sleep 1');
    const start = await exec('mongod --dbpath /data/mongo --port 27017 --bind_ip localhost --fork --logpath /data/mongo/mongod.log 2>&1');
    console.log('start:', start.stdout.slice(-200));
    for (let i = 0; i < 20; i++) {
      const r = await exec('mongosh --quiet --eval "db.adminCommand(\'ping\').ok" 2>&1');
      if (r.stdout.trim() === '1') { console.log('MONGO READY!'); break; }
      await new Promise(s => setTimeout(s, 2000));
    }
  }

  conn.end();
  console.log('\nDONE');
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 15000 });
