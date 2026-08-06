const fs = require('fs');
const os = require('os');
const path = require('path');

require('../source/utils/logger');

const gitConfigPath = path.join(os.tmpdir(), `mungit-test-gitconfig-${process.pid}`);

fs.writeFileSync(
  gitConfigPath,
  [
    '[user]',
    '\tname = Mungit Test',
    '\temail = mungit-test@example.com',
    '[protocol "file"]',
    '\tallow = always',
    '[safe]',
    '\tbareRepository = all',
    '',
  ].join(os.EOL)
);

process.env.GIT_CONFIG_GLOBAL = gitConfigPath;
process.env.GIT_CONFIG_NOSYSTEM = '1';

const gitConfigCount = Number(process.env.GIT_CONFIG_COUNT || 0);
process.env[`GIT_CONFIG_KEY_${gitConfigCount}`] = 'safe.bareRepository';
process.env[`GIT_CONFIG_VALUE_${gitConfigCount}`] = 'all';
process.env.GIT_CONFIG_COUNT = String(gitConfigCount + 1);

process.once('exit', () => {
  fs.rmSync(gitConfigPath, { force: true });
});
