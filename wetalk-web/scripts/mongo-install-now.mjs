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
  console.log('[!] extract + install + start mongo NOW');

  // 1. 杀所有 curl/mongo 相关进程
  await exec('pkill -f curl 2>/dev/null; pkill -f mongod 2>/dev/null; sleep 1; echo cleaned');

  // 2. 确认文件
  const fsize = await exec('ls -lh /tmp/mongo.tgz; file /tmp/mongo.tgz');
  console.log('file:', fsize.stdout.trim());

  // 3. 解压
  console.log('extracting...');
  const verDir = 'mongodb-linux-x86_64-ubuntu2204-7.0.14';
  const extract = await exec(`cd /tmp && rm -rf ${verDir} && tar xzf mongo.tgz && ls -la ${verDir}/bin/`);
  console.log(extract.stdout.trim());

  // 4. 安装
  await exec(`cp /tmp/${verDir}/bin/mongod /usr/local/bin/ && cp /tmp/${verDir}/bin/mongosh /usr/local/bin/ && chmod +x /usr/local/bin/mongod /usr/local/bin/mongosh && echo INSTALLED`);

  const which = await exec('which mongod && mongod --version 2>&1 | head -2');
  console.log('mongod:', which.stdout.trim());

  // 5. 启动 mongod（无认证模式先起来）
  console.log('starting mongod...');
  await exec('mkdir -p /data/mongo');
  const start = await exec('mongod --dbpath /data/mongo --port 27017 --bind_ip localhost --fork --logpath /data/mongo/mongod.log 2>&1');
  console.log('start:', start.stdout.trim(), start.stderr.trim());

  // 6. 等就绪
  for (let i = 0; i < 20; i++) {
    const r = await exec('mongosh --quiet --eval "db.adminCommand(\'ping\').ok" 2>&1');
    if (r.stdout.trim() === '1') { console.log('MONGO READY!'); break; }
    console.log(`  waiting ${i}...`);
    await sleep(2000);
  }

  // 7. 创建用户
  console.log('creating users...');
  const users = await exec(`mongosh --quiet --eval '
    admin = db.getSiblingDB("admin");
    try { admin.createUser({user:"root",pwd:"root_mongo_2024",roles:[{role:"root",db:"admin"}]}); print("ROOT_CREATED"); } catch(e) { print("ROOT_EXISTS"); }
    admin.auth("root", "root_mongo_2024");
    wetalk = db.getSiblingDB("wetalk");
    try { wetalk.createUser({user:"wetalk",pwd:"wetalk_mongo_2024",roles:[{role:"readWrite",db:"wetalk"}]}); print("WETALK_CREATED"); } catch(e) { print("WETALK_EXISTS"); }
  ' 2>&1`);
  console.log(users.stdout.trim());

  // 8. 重启带认证
  console.log('restart with auth...');
  await exec('pkill -f mongod; sleep 2');
  await exec('mongod --dbpath /data/mongo --port 27017 --bind_ip localhost --auth --fork --logpath /data/mongo/mongod.log 2>&1');
  await sleep(2000);

  const final = await exec('mongosh -u root -p root_mongo_2024 --authenticationDatabase admin --quiet --eval "db.adminCommand(\'ping\').ok" 2>&1');
  console.log('final ping:', final.stdout.trim());

  conn.end();
  console.log('\n=== MONGO INSTALLED + RUNNING ===');
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 15000 });
