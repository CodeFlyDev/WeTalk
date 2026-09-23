import { Client } from 'ssh2';
const conn = new Client();
function exec(cmd, timeout = 60000) {
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
  console.log('[M] connected');

  // 测试国内镜像速度
  console.log('=== test tsinghua mirror speed ===');
  const tspeed = await exec('curl -s -o /dev/null -w "time=%{time_total}s speed=%{speed_download}B/s\\n" https://mirrors.tuna.tsinghua.edu.cn/ubuntu-releases/24.04/SHA256SUMS 2>&1', 20000);
  console.log(tspeed.stdout || tspeed.stderr);

  // 下载 MongoDB 7 二进制（用清华镜像或阿里云镜像）
  // MongoDB 官方也有国内镜像
  console.log('\n=== download mongodb binary ===');
  const mongoVer = 'mongodb-linux-x86_64-ubuntu2204-7.0.14';
  const urls = [
    `https://mirrors.aliyun.com/mongodb/linux/${mongoVer}.tgz`,
    `https://fastdl.mongodb.org/linux/${mongoVer}.tgz`,
  ];

  let downloaded = false;
  for (const url of urls) {
    console.log(`trying: ${url}`);
    const r = await exec(`cd /tmp && timeout 300 curl -fSL -o mongo.tgz "${url}" 2>&1; echo "EXIT=$?"`, 310000);
    console.log(r.stdout.slice(-300));
    if (r.stdout.includes('EXIT=0') || r.code === 0) { downloaded = true; break; }
  }

  if (!downloaded) {
    console.log('all downloads failed, trying ubuntu repo...');
    // 试试 Ubuntu apt 安装
    const apt = await exec(`apt-get update 2>&1 | tail -3; apt-get install -y gnupg curl 2>&1 | tail -3; curl -fsSL https://pgp.mongodb.com/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg 2>&1; echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" > /etc/apt/sources.list.d/mongodb-org-7.0.list 2>&1; apt-get update 2>&1 | tail -3; apt-get install -y mongodb-org 2>&1 | tail -5; echo APT_DONE`, 120000);
    console.log(apt.stdout.slice(-500));
  } else {
    // 解压并安装
    console.log('extracting...');
    await exec('cd /tmp && tar xzf mongo.tgz && ls -la');
    await exec(`cp /tmp/${mongoVer}/bin/mongod /usr/local/bin/ && cp /tmp/${mongoVer}/bin/mongosh /usr/local/bin/ && chmod +x /usr/local/bin/mongod /usr/local/bin/mongosh`);
    console.log('mongod installed');
  }

  // 创建数据目录和用户
  console.log('\n=== setup mongo data dir ===');
  await exec('mkdir -p /data/mongo && chown -R $(whoami) /data/mongo');

  // 启动 mongod（后台）
  console.log('=== start mongod ===');
  await exec('pkill -f mongod 2>/dev/null; sleep 1');
  const start = await exec(`mongod --dbpath /data/mongo --port 27017 --bind_ip localhost --fork --logpath /data/mongo/mongod.log 2>&1`);
  console.log('start result:', start.stdout, start.stderr);

  // 等就绪并初始化
  console.log('\n=== init mongo ===');
  for (let i = 0; i < 20; i++) {
    const r = await exec('mongosh --quiet --eval "db.adminCommand(\'ping\').ok" 2>&1');
    if (r.stdout.trim() === '1') { console.log('mongo ready!'); break; }
    console.log(`  waiting ${i}...`);
    await new Promise(s => setTimeout(s, 2000));
  }

  // 创建 admin 用户
  await exec(`mongosh --quiet --eval '
    db = db.getSiblingDB("admin");
    try { db.createUser({user: "root", pwd: "root_mongo_2024", roles: [{role: "root", db: "admin"}]}); } catch(e) {}
    db.auth("root", "root_mongo_2024");
    db = db.getSiblingDB("wetalk");
    try { db.createUser({user: "wetalk", pwd: "wetalk_mongo_2024", roles: [{role: "readWrite", db: "wetalk"}]}); } catch(e) {}
    print("USERS_CREATED");
  ' 2>&1`);

  // 关闭无认证 mongod，重启带认证
  await exec('pkill -f mongod; sleep 2');
  const secure = await exec(`mongod --dbpath /data/mongo --port 27017 --bind_ip localhost --auth --fork --logpath /data/mongo/mongod.log 2>&1`);
  console.log('secure start:', secure.stdout);

  const final = await exec('mongosh -u root -p root_mongo_2024 --authenticationDatabase admin --quiet --eval "db.adminCommand(\'ping\')" 2>&1');
  console.log('\n=== final ping ===\n' + final.stdout);

  conn.end();
  console.log('\nDONE');
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 15000 });
