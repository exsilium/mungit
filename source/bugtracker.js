'use strict';

const logger = require('./utils/logger');
const sysinfo = require('./sysinfo');
const config = require('./config');
const raven = require('raven-js');
const client = new raven.Client(
  'https://1ccfef6f2d3e41a2b74372e22546731c:17bd0b6ba90a489c981365323b518419@sentry.io/244250'
);

class BugTracker {
  constructor(subsystem) {
    if (!config.bugtracking) return;

    this.subsystem = subsystem;
    this.appVersion = 'unknown';
    this.userHash = sysinfo.getUserHash();
    this.appVersion = config.ungitDevVersion;
    logger.info(`BugTracker set version: ${this.appVersion}`);
  }
  notify(exception, clientName) {
    if (!config.bugtracking) return;

    const options = {
      user: { id: this.userHash },
      tags: {
        version: this.appVersion,
        subsystem: this.subsystem,
        deployment: config.desktopMode ? 'desktop' : 'web',
      },
    };

    client.captureException(exception, options);
  }
}
module.exports = BugTracker;
