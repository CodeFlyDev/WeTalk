import { execSync } from 'child_process';
import fs from 'fs';

const javaHome = 'C:\\Program Files\\Java\\jdk-21.0.11';
const serverDir = 'e:/Github/WeTalk/wetalk-server';

// Clean ALL target dirs first
console.log('Cleaning all targets...');
try {
  execSync('mvnw.cmd clean -q', {
    cwd: serverDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
    env: { ...process.env, JAVA_HOME: javaHome },
    shell: true,
  });
  console.log('clean done');
} catch (e) {
  console.log('clean warning:', e.stdout?.slice(-500));
}

// Now build with -DskipTests
console.log('Building...');
try {
  const out = execSync('mvnw.cmd package -DskipTests', {
    cwd: serverDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 600000,
    env: { ...process.env, JAVA_HOME: javaHome, MAVEN_OPTS: '-Xmx1024m -Xms256m' },
    shell: true,
  });
  console.log(out.slice(-1500));
  console.log('BUILD SUCCESS');
} catch (e) {
  console.log('BUILD FAILED');
  fs.writeFileSync('e:/Github/WeTalk/build-error.txt', (e.stdout || '') + '\n---\n' + (e.stderr || ''));
  console.log('Written to build-error.txt');
  console.log((e.stdout || '').slice(-2000));
}
