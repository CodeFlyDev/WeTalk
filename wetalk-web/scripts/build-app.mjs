import { execSync } from 'child_process';

const javaHome = 'C:\\Program Files\\Java\\jdk-21.0.11';
const serverDir = 'e:/Github/WeTalk/wetalk-server';

console.log('Building wetalk-app only...');
try {
  const out = execSync('mvnw.cmd package -pl wetalk-app -am -DskipTests', {
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
  console.log((e.stdout || '').slice(-2000));
}
