var url = require('url');
var path = require('path');
const fs = require('fs');
var express = require('express');
var proxy = require('express-http-proxy');
var createError = require('http-errors');
const JSON5 = require('json5');
require('json5/lib/register');

var router = express.Router();
// 这里面的配置修改完后，需要重启项目才能生效
var config = require('../config.json5');
// 这里面的配置修改完后，在下一次请求可以立即生效
var dynamicConfig = {};

// https://stackoverflow.com/questions/31673587/error-unable-to-verify-the-first-certificate-in-nodejs
// https://stackoverflow.com/questions/36773992/unable-to-use-self-signed-certificate-with-node-ssl-root-cas
// 解决 Error: unable to verify the first certificate
// process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0
// 不能解决 Error: unable to verify the first certificate
// require('https').globalAgent.options.ca = require('ssl-root-cas/latest').create();

/* //服务器端设置允许跨域
app.all('/*',(req,res,next)=>{
	//告诉浏览器一些额外信息
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("X-Powered-By",' 3.2.1')
	res.setHeader("Content-Type", "application/json;charset=utf-8");
	
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Access-Token");
  res.setHeader("Access-Control-Expose-Headers", "*");
	
	next();
}); */
// 解决跨域
router.all('*', function(req, res, next) {
  res.header({
    // The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' when the request's credentials mode is 'include'.
    // "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Origin": req.headers.origin,
    "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS,POST,PUT",
    "Access-Control-Allow-Headers": "Access-Control-Request-Method, Access-Control-Allow-Headers, Access-Control-Request-Headers, Origin, X-Requested-With, Content-Type, Content-Length, Accept, Authorization, Token, Cookie",
    "Access-Control-Max-Age": 60 * 60 * 24 * 7,
    "Access-Control-Allow-Credentials": true
  });
  // response.setHeader("Access-Control-Allow-Headers", "Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers");
  // res.header("Access-Control-Allow-Credentials", "true");
  // res.header("Access-Control-Allow-Headers", "Content-Type,Content-Length, Authorization, Accept,X-Requested-With");
  // res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
  // res.header("X-Powered-By", ' 3.2.1')
  // res.header("Content-Type", "application/json;charset=utf-8");
  // res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS,PATCH");
  // res.header('Access-Control-Max-Age',1728000);//预请求缓存20天
  if (req.method === "OPTIONS") {
    res.status(200).send(req.headers['Access-Control-Request-Method'] || req.headers['access-control-request-method']);
  } else {
    next();
  }
});

// 打印时间 与 读取配置
router.use(function (req, res, next) {
  const dynamicConfigPath = path.join(__dirname, '../dynamicConfig.json5');
  const content = fs.readFileSync(dynamicConfigPath, 'utf8');
  try {
    dynamicConfig = JSON5.parse(content);
    console.log('\n\r**********************************************************************');
    console.log(`时间： ${new Date()}`);
    console.log(`${req.method} ${req.url}`);
    console.log(`路径为 ${dynamicConfigPath} 的配置内容为：`);
    console.log(JSON.stringify(dynamicConfig, null, 4));
    console.log('**********************************************************************\n\r');
    next();
  } catch (err) {
    err.message = dynamicConfigPath + ': ' + err.message;
    next(err);
  }
});

// 代理后台api
router.use(proxy(config.proxyApiPath, {
  // 返回true时，执行本中间件处理
  filter: function(req, res) {
    return dynamicConfig.skipProxyApi === false;
  },
  proxyReqPathResolver: function (req) {
    const requestUrl = req.url.replace(new RegExp(`^\/${config.proxyPrefix}`), '');
    const requestPath = config.proxyApiPath + requestUrl.replace(/^\//, '');
    return requestPath;
  },
  proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
    // you can update headers
    proxyReqOpts.headers['cookie'] = dynamicConfig.proxyApiCookie;
    // 解决 Error: unable to verify the first certificate
    if (['https', 'https:'].includes(url.parse(config.proxyApiPath).protocol)) {
      proxyReqOpts.rejectUnauthorized = false;
    }
    return proxyReqOpts;
  },
  /* Allows you to inspect the proxy response,
  and decide if you want to continue processing (via express-http-proxy) or
  call next() to return control to express. */
  skipToNextHandlerFilter: function(proxyRes) {
    proxyRes.headers[dynamicConfig.addResponseHeaders.apiPath] = config.proxyApiPath;
    proxyRes.headers[dynamicConfig.addResponseHeaders.apiFullPath] = proxyRes.req.path;
    console.log('\n\r**********************************************************************');
    console.log(`时间： ${new Date()}`);
    console.log(`${proxyRes.req.method} 请求 ${proxyRes.req.path} 时，skipToNextHandlerFilter 的 statusCode 为：`);
    console.log(proxyRes.statusCode);
    console.log('**********************************************************************\n\r');
    /* 包含302，是因为当cookie失效时后台api会返回这个status，此时需要代理到 fallbackProxyApi
    从浏览器控制台里可以查看response header以作后续处理 */
    /* 需要修改/node_modules/express-http-proxy/app/steps/maybeSkipToNextHandler.js里
      第15行 return Promise.reject(container.user.next()); 为
            return Promise.reject();
    https://github.com/villadora/express-http-proxy/issues/390
    https://github.com/villadora/express-http-proxy/commit/c5660c22e607700f1d1d8a002262100f427ca634 */
    return [302, 404].includes(proxyRes.statusCode);
  },
  proxyErrorHandler: function(err, res, next) {
    console.log('\n\r**********************************************************************');
    console.log(`时间： ${new Date()}`);
    console.log(`代理 ${config.proxyApiPath}，${res.req.method} 请求 ${res.req.url} 时`);
    console.log('proxyErrorHandler报错如下：');
    console.log(err);
    console.log('**********************************************************************\n\r');
    next(err);
  },
  timeout: 10 * 1000,
  limit: '10mb',
  preserveHostHdr: true,
}));

// 代理fallbackProxyApi
router.use(proxy(config.fallbackProxyApiPath, {
  proxyReqPathResolver: function (req) {
    const requestUrl = req.url.replace(new RegExp(`^\/${config.proxyPrefix}`), '');
    const requestPath = config.fallbackProxyApiPath + requestUrl.replace(/^\//, '');
    return requestPath;
  },
  proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
    proxyReqOpts.headers['Access-Control-Request-Method'] = srcReq.method.toUpperCase();
    return proxyReqOpts;
  },
  skipToNextHandlerFilter: function(proxyRes) {
    proxyRes.headers[dynamicConfig.addResponseHeaders.apiPath] = config.fallbackProxyApiPath;
    proxyRes.headers[dynamicConfig.addResponseHeaders.apiFullPath] = proxyRes.req.path;
    return [404].includes(proxyRes.statusCode);
  },
  proxyErrorHandler: function(err, res, next) {
    next(err);
  },
  timeout: 10 * 1000,
  limit: '10mb',
  preserveHostHdr: true,
}));

// 404
router.use(function (req, res, next) {
  next(createError(404));
});

// error
router.use(function(err, req, res, next) {
  console.log('\n\r**********************************************************************');
  console.log(`时间： ${new Date()}`);
  console.log(`${req.method} 请求 ${req.url} 时`);
  console.log('express errorHandler报错如下：');
  console.log(err);
  console.log('**********************************************************************\n\r');
  var status = err.status;
  res.status(status || 500);
  // 返回内容可自己修改以适配
  res.json({
    error: true,
    status: status,
    errorMessage: err.message || '未获取到数据或请求失败'
  });
});

module.exports = router;
