import { execSync } from 'child_process';
const out = execSync('git diff -- wetalk-server/wetalk-message/ wetalk-server/wetalk-ai/', { 
  encoding: 'utf8', cwd: 'e:/Github/WeTalk', timeout: 15000 
});
console.log(out.slice(0, 5000));
