import { Client } from 'ssh2';
const conn = new Client();
const sleep = ms => new Promise(r => setTimeout(r, ms));
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
  console.log('[M] mongosh + auth setup');

  // 1. 检查 mongod 是否在跑
  const ps = await exec('pgrep -fa mongod; echo "---"; ss -tlnp | grep 27017');
  console.log('mongod:', ps.stdout.trim());

  // 2. 下载 mongosh
  console.log('\ndownloading mongosh...');
  await exec('pkill -f mongosh 2>/dev/null; cd /tmp && nohup curl -fSL -o mongosh.tgz "https://fastdl.mongodb.org/mongosh/mongosh-2.3.2-linux-x64.tgz" > /tmp/mongosh-dl.log 2>&1 & disown');

  // 轮询等下载
  for (let i = 0; i < 30; i++) {
    const fs = await exec('stat -c %s /tmp/mongosh.tgz 2>/dev/null || echo 0');
    const sizeMB = (parseInt(fs.stdout.trim()) / 1024 / 1024).toFixed(1);
    const curlAlive = await exec('pgrep -f "mongosh.tgz" >/dev/null && echo RUNNING || echo DONE');
    console.log(`  [${i}] mongosh.tgz: ${sizeMB}MB ${curlAlive.stdout.trim()}`);
    if (curlAlive.stdout.includes('DONE') && parseInt(fs.stdout.trim()) > 5000000) break;
    await sleep(15000);
  }

  // 3. 解压安装 mongosh
  console.log('\ninstalling mongosh...');
  await exec('cd /tmp && rm -rf mongosh-* && tar xzf mongosh.tgz && ls -la mongosh-*/bin/mongosh 2>/dev/null');
  const verMatch = await exec('ls -d /tmp/mongosh-*/ 2>/dev/null | head -1');
  const dirName = verMatch.stdout.trim().replace(/\/$/, '');
  if (dirName) {
    await exec(`cp ${dirName}/bin/mongosh /usr/local/bin/ && chmod +x /usr/local/bin/mongosh && echo MONGOSH_OK`);
  }
  const which = await exec('which mongosh && mongosh --version 2>&1 | head -1');
  console.log('mongosh:', which.stdout.trim());

  // 4. 验证 mongo 无认证连接
  console.log('\nconnect to mongo (no auth)...');
  const ping = await exec('mongosh --quiet --eval "db.adminCommand(\'ping\').ok" 2>&1');
  console.log('ping:', ping.stdout.trim());

  // 5. 创建用户
  if (ping.stdout.includes('1')) {
    console.log('creating users...');
    const users = await exec(`mongosh --quiet --eval '
      admin = db.getSiblingDB("admin");
      try { admin.createUser({user:"root",pwd:"root_mongo_2024",roles:[{role:"root",db:"admin"}]}); print("ROOT_OK"); } catch(e) { print("ROOT_EXISTS:" + e.message); }
    ' 2>&1`);
    console.log('users:', users.stdout.trim());

    // 6. 重启带认证
    console.log('\nrestart with auth...');
    await exec('pkill -f mongod; sleep 2');
    await exec('mongod --dbpath /data/mongo --port 27017 --bind_ip localhost --auth --fork --logpath /data/mongo/mongod.log 2>&1');
    await sleep(2000);

    const final = await exec('mongosh -u root -p root_mongo_2024 --authenticationDatabase admin --quiet --eval "db.adminCommand(\'ping\').ok" 2>&1');
    console.log('final auth ping:', final.stdout.trim());
  }

  conn.end();
  console.log('\nDONE');
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 15000 });
