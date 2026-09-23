import { Client } from 'ssh2';
const conn = new Client();
const sleep = ms => new Promise(r => setTimeout(r, ms));
function exec(cmd, timeout = 600000) {
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
  console.log('[F] mongo final install');

  // 1. 清理旧下载
  await exec('rm -rf /tmp/mongo.tgz /tmp/mongodb-* 2>/dev/null; echo cleaned');

  // 2. 后台下载（不用 timeout，让它跑完）
  console.log('downloading mongodb binary (116KB/s, ~18min)...');
  const dl = await exec(`cd /tmp && nohup curl -fSL -o mongo.tgz "https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2204-7.0.14.tgz" > /tmp/curl.log 2>&1 & disown; echo STARTED_PID=$!`);
  console.log(dl.stdout.trim());

  // 3. 轮询等待下载完成
  for (let i = 0; i < 60; i++) {
    const fsize = await exec('stat -c %s /tmp/mongo.tgz 2>/dev/null || echo 0');
    const sizeMB = (parseInt(fsize.stdout.trim()) / 1024 / 1024).toFixed(1);
    const curlAlive = await exec('pgrep -f "curl.*mongo" >/dev/null && echo RUNNING || echo DONE');
    console.log(`  [${i}] mongo.tgz: ${sizeMB}MB curl: ${curlAlive.stdout.trim()}`);
    if (curlAlive.stdout.includes('DONE') && parseInt(fsize.stdout.trim()) > 10000000) {
      console.log('DOWNLOAD COMPLETE!');
      break;
    }
    await sleep(15000); // 每 15 秒查一次
  }

  // 4. 解压安装
  console.log('\nextracting...');
  const verDir = 'mongodb-linux-x86_64-ubuntu2204-7.0.14';
  await exec(`cd /tmp && tar xzf mongo.tgz && ls -la ${verDir}/bin/`);
  await exec(`cp /tmp/${verDir}/bin/mongod /usr/local/bin/ && cp /tmp/${verDir}/bin/mongosh /usr/local/bin/ && chmod +x /usr/local/bin/mongod /usr/local/bin/mongosh && echo INSTALLED`);

  const which = await exec('which mongod && mongod --version 2>&1 | head -1');
  console.log('installed:', which.stdout.trim());

  // 5. 启动 mongod
  console.log('\nstarting mongod...');
  await exec('mkdir -p /data/mongo');
  await exec('pkill -f mongod 2>/dev/null; sleep 1');
  const start = await exec('mongod --dbpath /data/mongo --port 27017 --bind_ip localhost --fork --logpath /data/mongo/mongod.log 2>&1');
  console.log('start:', start.stdout.trim());

  // 6. 等就绪
  for (let i = 0; i < 30; i++) {
    const r = await exec('mongosh --quiet --eval "db.adminCommand(\'ping\').ok" 2>&1');
    if (r.stdout.trim() === '1') { console.log('MONGO READY!'); break; }
    await sleep(2000);
  }

  // 7. 创建用户（无认证模式下初始化）
  console.log('\ninit users...');
  const initResult = await exec(`mongosh --quiet --eval '
    admin = db.getSiblingDB("admin");
    try { admin.createUser({user:"root",pwd:"root_mongo_2024",roles:[{role:"root",db:"admin"}]}); } catch(e) {}
    admin.auth("root", "root_mongo_2024");
    wetalk = db.getSiblingDB("wetalk");
    try { wetalk.createUser({user:"wetalk",pwd:"wetalk_mongo_2024",roles:[{role:"readWrite",db:"wetalk"}]}); } catch(e) {}
    print("USERS_OK");
  ' 2>&1`);
  console.log(initResult.stdout.trim());

  // 8. 重启带认证
  console.log('\nrestart with auth...');
  await exec('pkill -f mongod; sleep 2');
  await exec('mongod --dbpath /data/mongo --port 27017 --bind_ip localhost --auth --fork --logpath /data/mongo/mongod.log 2>&1');

  const final = await exec('mongosh -u root -p root_mongo_2024 --authenticationDatabase admin --quiet --eval "db.adminCommand(\'ping\').ok" 2>&1');
  console.log('final ping:', final.stdout.trim());

  conn.end();
  console.log('\n=== MONGO INSTALL COMPLETE ===');
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 15000 });
