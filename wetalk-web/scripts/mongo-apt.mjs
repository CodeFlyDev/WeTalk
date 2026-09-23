import { Client } from 'ssh2';
const conn = new Client();
function exec(cmd, timeout = 120000) {
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
  console.log('[A] trying apt install mongodb-org...');

  // 清理残留
  await exec('rm -rf /tmp/mongo.tgz /tmp/mongodb-* 2>/dev/null; echo cleaned');

  // 方式 1：直接 apt 安装（Ubuntu 22.04 默认源可能有 mongodb 或需要加官方源）
  console.log('\n=== apt-get install mongodb (from Ubuntu repo) ===');
  const r1 = await exec('apt-get update -qq 2>&1 | tail -5; apt-get install -y mongodb 2>&1 | tail -10; echo EXIT=$?', 180000);
  console.log(r1.stdout.slice(-800));

  // 如果上面没装上，加 MongoDB 官方源
  if (!r1.stdout.includes('EXIT=0')) {
    console.log('\n=== try MongoDB official apt repo ===');
    await exec('apt-get install -y gnupg curl 2>&1 | tail -3');
    await exec('curl -fsSL https://pgp.mongodb.com/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg 2>&1');
    await exec('echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" > /etc/apt/sources.list.d/mongodb-org-7.0.list');
    await exec('apt-get update -qq 2>&1 | tail -5');
    const r2 = await exec('apt-get install -y mongodb-org 2>&1 | tail -10; echo EXIT=$?', 180000);
    console.log(r2.stdout.slice(-800));
  }

  // 检查是否装上了
  const which = await exec('which mongod; mongod --version 2>&1 | head -3; which mongosh');
  console.log('\n=== which ===\n' + which.stdout + which.stderr);

  if (which.stdout.includes('mongod')) {
    // 启动
    console.log('\n=== start mongo ===');
    await exec('mkdir -p /data/mongo');
    await exec('pkill -f mongod 2>/dev/null; sleep 1');
    const start = await exec('mongod --dbpath /data/mongo --port 27017 --bind_ip localhost --fork --logpath /data/mongo/mongod.log 2>&1');
    console.log('start:', start.stdout.slice(-300));

    // 等就绪
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
