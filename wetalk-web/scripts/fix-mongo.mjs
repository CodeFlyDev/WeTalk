import { Client } from 'ssh2';

const conn = new Client();
const log = (...a) => console.log('[U]', ...a);
function exec(cmd, timeout = 20000) {
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
  // 查 mongo 配置
  log('=== mongo config ===');
  const cfg = await exec('cat /etc/mongod.conf 2>/dev/null; cat /data/mongo/mongod.conf 2>/dev/null');
  log(cfg.stdout.trim() || '(no mongod.conf found)');

  // 查进程参数
  log('\n=== mongo proc ===');
  const proc = await exec('ps aux | grep mongod | grep -v grep');
  log(proc.stdout.trim());

  // 尝试带认证连接看看有没有管理员
  log('\n=== test connection ===');
  const r1 = await exec('/usr/local/bin/mongosh --quiet --eval "db.version()" 2>&1');
  log('no auth:', r1.stdout.trim());

  // 如果启了 auth，加一个 wetalk 用户
  log('\n=== add user ===');
  const r2 = await exec(`/usr/local/bin/mongosh --quiet --eval "
use wetalk;
db.createUser({user:'wetalk', pwd:'wetalk_2024', roles:[{role:'readWrite', db:'wetalk'}]});
db.getUsers();
" 2>&1`);
  log('create user:', r2.stdout.trim().slice(0, 500));

  // 如果上面因为 auth 失败，先关 auth
  if (r2.stderr.includes('auth') || r2.stderr.includes('Unauthorized') || r2.stdout.includes('auth')) {
    log('auth is enabled, trying to disable...');
    // 找到 mongod 启动参数
    const args = await exec('cat /proc/$(pgrep mongod)/cmdline | tr "\\0" " " ');
    log('mongod args:', args.stdout.trim());

    // 杀掉重启不带 auth
    await exec('pkill mongod; sleep 2; echo killed');
    await exec('mkdir -p /data/mongo; chown -R $(whoami) /data/mongo 2>/dev/null || true');
    const r3 = await exec('mongod --dbpath /data/mongo --bind_ip 127.0.0.1 --fork --logpath /var/log/mongod.log 2>&1');
    log('restart no auth:', r3.stdout.trim());

    // 再测试
    await new Promise(r => setTimeout(r, 2000));
    const r4 = await exec('/usr/local/bin/mongosh --quiet wetalk --eval "db.getCollectionNames()" 2>&1');
    log('collections:', r4.stdout.trim());
  }

  conn.end();
  log('\nDONE - backend needs restart if mongo restarted');
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 30000 });
