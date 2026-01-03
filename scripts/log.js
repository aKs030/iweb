function _fmt(level, msg) {
  const time = new Date().toISOString();
  if (typeof msg === 'string') console.log(`[iweb:${level}] ${time} - ${msg}`);
  else console.log(`[iweb:${level}] ${time} -`, msg);
}

function info(msg) {
  _fmt('info', msg);
}

function warn(msg) {
  _fmt('warn', msg);
}

function error(msg) {
  _fmt('error', msg);
}

module.exports = { info, warn, error };
