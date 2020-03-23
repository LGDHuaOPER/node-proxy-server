const heartbeat = require('./heartbeat.js');

const httpConfig = require('./httpConfig.js');

heartbeat();

global.setInterval(function() {
  heartbeat();
}, httpConfig.intervalTime);
