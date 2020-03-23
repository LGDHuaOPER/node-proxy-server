const http = require('http');
const https = require('https');

const httpConfig = require('./httpConfig.js');

const isHTTPS = /^https:/i.test(httpConfig.requestPath)
const httpModule = isHTTPS ? https : http;

module.exports = function heartbeat() {
  const req = httpModule.request(httpConfig.requestPath, httpConfig.requestOptions, (res) => {
    console.log(`\n\r时间：${new Date().toLocaleString()}`);
    console.log(`状态码: ${res.statusCode}`);
    console.log(`响应头: ${JSON.stringify(res.headers)}\n\r`);
  })

  req.on('error', (e) => {
    console.log(`\n\r时间：${new Date().toLocaleString()}`);
    console.log(`请求遇到问题: ${e.message}\n\r`);
  });

  if (httpConfig.requestOptions.method.toUpperCase() === 'POST') {
    // 将数据写入请求主体。
    req.write(httpConfig.postData);
  }

  req.end();
}
