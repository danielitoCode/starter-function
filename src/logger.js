const util = require('util');

function timestamp() {
  return new Date().toISOString();
}

function formatArgs(args) {
  return args.map(a => (typeof a === 'string' ? a : util.inspect(a, { depth: 4 }))).join(' ');
}

function info(...args) {
  console.log(`[INFO] ${timestamp()} - ${formatArgs(args)}`);
}

function warn(...args) {
  console.warn(`[WARN] ${timestamp()} - ${formatArgs(args)}`);
}

function error(...args) {
  console.error(`[ERROR] ${timestamp()} - ${formatArgs(args)}`);
}

function debug(...args) {
  if (process.env.DEBUG) {
    console.debug(`[DEBUG] ${timestamp()} - ${formatArgs(args)}`);
  }
}

module.exports = { info, warn, error, debug };
