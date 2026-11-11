/**
 * 在 dist 根目录生成 BUILD-INFO 文件，记录 git 提交信息与构建时间
 * 参照 moondrop-service/scripts/gen-build-info.js
 * 用法：build 完成后调用 `node scripts/gen-build-info.js`
 */
const { execSync } = require('child_process');
const { writeFileSync, mkdirSync, existsSync } = require('fs');
const { join, resolve } = require('path');

const projectRoot = resolve(__dirname, '..');
const distDir = join(projectRoot, 'dist');

function runGit(args) {
  try {
    return execSync(`git ${args}`, {
      cwd: projectRoot,
      encoding: 'utf8',
    }).replace(/\r?\n$/, '');
  } catch (_) {
    return 'unknown';
  }
}

const shortHash = runGit('rev-parse --short HEAD');
const commitMsg = runGit('log -1 --pretty=%s');
const branch = runGit('rev-parse --abbrev-ref HEAD');
const author = runGit('log -1 --pretty=%an');
const commitDate = runGit('log -1 --pretty=%ad');
const buildTime = new Date().toISOString();

// 最近 10 条提交（新→旧），供版本信息展示更新内容
const logRaw = runGit(
  'log -10 "--pretty=format:%h|%s|%ad" "--date=format:%Y-%m-%d %H:%M"',
);
const commits =
  logRaw === 'unknown'
    ? []
    : logRaw
        .split('\n')
        .filter((line) => line.includes('|'))
        .map((line) => {
          const first = line.indexOf('|');
          const last = line.lastIndexOf('|');
          return {
            hash: line.slice(0, first),
            subject: line.slice(first + 1, last),
            date: line.slice(last + 1),
          };
        });

const content = [
  `build time : ${buildTime}`,
  `git branch : ${branch}`,
  `commit hash: ${shortHash}`,
  `commit msg : ${commitMsg}`,
  `author     : ${author}`,
  `commit date: ${commitDate}`,
  '',
].join('\n');

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}
writeFileSync(join(distDir, 'BUILD-INFO'), content, 'utf8');
writeFileSync(
  join(distDir, 'BUILD-INFO.json'),
  JSON.stringify(
    { buildTime, branch, hash: shortHash, commitMsg, author, commitDate, commits },
    null,
    2,
  ),
  'utf8',
);

console.log(`[build-info] ${shortHash} | ${branch} | ${commitMsg} | ${buildTime}`);
