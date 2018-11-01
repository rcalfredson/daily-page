const jwt = require('jsonwebtoken');

function expiringKey(expiryMins = 1440) {
  return jwt.sign({ exp: Math.floor(Date.now() / 1000) + (expiryMins * 60) }, process.env.APP_AUTH);
}

function verifyReq(req) {
  jwt.verify(req.headers.authorization, process.env.APP_AUTH);
}

module.exports = {
  expiringKey,
  verifyReq,
};
