'use strict';
const testuser = { username: 'testuser', password: 'testpassword' };
const environment = require('./environment')({
  serverStartupOptions: ['--authentication', `--users.${testuser.username}=${testuser.password}`],
  showServerOutput: true
});
const getmac = require('getmac');
const md5 = require('blueimp-md5');
const jwt = require('jsonwebtoken');

describe('[AUTHENTICATION]', () => {
  before('Environment init without temp folder', () => environment.init());
  after('Close nightmare', () => environment.nm.end());

  it('Open invalid path screen - faulty token, unauthorized', () => {
    return environment.goto(environment.getRootUrl() + '/#/repository?path=test&token=faultytoken')
      .wait('.login .loginError');
  });

  it('Open invalid path screen - proper token, authorized', () => {
    getmac.getMac((err, addr) => {
      if (err) {
        addr = "abcde";
      }
      var userHash = md5(addr);
      return environment.goto(environment.getRootUrl() + '/#/repository?path=test&token=' + jwt.sign(testuser, userHash, { noTimestamp: true }))
        .wait('.invalid-path');
    });
  });
});
