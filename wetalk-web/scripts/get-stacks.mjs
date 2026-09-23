import { Client } from 'ssh2';
const conn = new Client();
const log = (...a) => console.log('[U]', ...a);
function exec(cmd, timeout = 15000) {
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
  // 抓所有错误栈
  const r = await exec('grep -B1 -A8 "unhandled exception" /opt/wetalk/wetalk.log | head -80');
  log(r.stdout.trim());

  log('\n=== No static resource ===');
  const r2 = await exec('grep "No static resource" /opt/wetalk/wetalk.log | sort -u');
  log(r2.stdout.trim());

  log('\n=== Missing param ===');
  const r3 = await exec('grep -A1 "MissingServlet\\|must not be blank\\|HttpRequestMethodNot" /opt/wetalk/wetalk.log | sort -u');
  log(r3.stdout.trim());

  conn.end();
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
  .connect({ host: '103.217.186.134', port: 22, username: 'root', password: 'Beingawaiter.495', readyTimeout: 30000 });
