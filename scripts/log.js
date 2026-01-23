#!/usr/bin/env node
function _fmt(level, msg) {
  const ts = new Date().toISOString();
  return `[${ts}] [${level}] ${msg}`;
}

function info(msg) {
  console.log(_fmt("INFO", msg));
}

function warn(msg) {
  console.warn(_fmt("WARN", msg));
}

function error(msg) {
  console.error(_fmt("ERROR", msg));
}

module.exports = { info, warn, error };
