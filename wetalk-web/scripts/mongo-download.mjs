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
  console.log('[D] trying multiple mongo binary sources...');

  const urlList = [
    // 华为云
    'https://repo.huaweicloud.com/mongodb/linux/mongodb-linux-x86_64-ubuntu2204-7.0.14.tgz',
    // 腾讯云
    'https://mirrors.cloud.tencent.com/mongodb/linux/mongodb-linux-x86_64-ubuntu2204-7.0.14.tgz',
    // 阿里云（换路径）
    'https://mirrors.aliyun.com/mongodb/linux/mongodb-linux-x86_64-ubuntu2204-7.0.14.tgz',
    // 官方 fastdl
    'https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2204-7.0.14.tgz',
    // 试试 7.0.12
    'https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2204-7.0.12.tgz',
  ];

  for (const url of urlList) {
    console.log(`\n--- ${url} ---`);
    const r = await exec(`curl -sI -o /dev/null -w "HTTP %{http_code} size=%{size_download} time=%{time_total}s\\n" "${url}" 2>&1`, 15000);
    console.log(r.stdout.trim());
    if (r.stdout.includes('HTTP 200')) {
      console.log('  GOOD! downloading...');
      const dl = await exec(`cd /tmp && rm -f mongo.tgz && curl -fSL -o mongo.tgz "${url}" 2>&1 && ls -la /tmp/mongo.tgz && echo DL_OK`, 300000);
      console.log(dl.stdout.slice(-300));
      if (dl.stdout.includes('DL_OK')) {
        console.log('  SUCCESS! extracting...');
        const verMatch = url.match(/mongodb-linux-x86_64-ubuntu2204-[\d.]+/);
        const dirName = verMatch ? verMatch[0] : 'mongodb';
        await exec(`cd /tmp && tar xzf mongo.tgz && cp /tmp/${dirName}/bin/mongod /usr/local/bin/ && cp /tmp/${dirName}/bin/mongosh /usr/local/bin/ && chmod +x /usr/local/bin/mongod /usr/local/bin/mongosh && echo INSTALLED`);
        const which = await exec('which mongod && mongod --version 2>&1 | head -1');
        console.log('  ' + which.stdout.trim());
        break;
      }
    }
  }

  // 如果还是没装上，试试 6.0 版本（可能更小/更快）
  const which = await exec('which mongod 2>&1');
  if (!which.stdout.includes('mongod')) {
    console.log('\n=== trying mongo 6.0 ===');
    const r = await exec('curl -sI https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2204-6.0.16.tgz 2>&1 | head -10', 15000);
    console.log(r.stdout);
  }

  conn.end();
  console.log('\nDONE');
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 15000 });
