import { execSync } from 'child_process';
import fs from 'fs';

const javaHome = 'C:\\Program Files\\Java\\jdk-21.0.11';
const serverDir = 'e:/Github/WeTalk/wetalk-server';

// Read full error output from maven
try {
  const out = execSync('mvnw.cmd clean compile -pl wetalk-message -am -e', {
    cwd: serverDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 300000,
    env: { ...process.env, JAVA_HOME: javaHome },
    shell: true,
  });
  console.log(out);
} catch (e) {
  // Write to file to inspect
  fs.writeFileSync('e:/Github/WeTalk/build-error.txt', e.stdout + '\n---STDERR---\n' + e.stderr);
  console.log('Written to build-error.txt');
  console.log('Last 2000 chars:');
  console.log((e.stdout || '').slice(-2000));
}
