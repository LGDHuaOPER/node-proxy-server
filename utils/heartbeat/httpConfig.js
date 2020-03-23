const querystring = require('querystring');

module.exports = {
  requestPath: '',
  requestOptions: {
    method: 'GET',
    headers: {
      'Cookie': 'JSESSIONID='
    },
  },
  postData: querystring.stringify({
    'msg': '你好世界'
  }),
  intervalTime: 1000 * 60 * 2,
};
