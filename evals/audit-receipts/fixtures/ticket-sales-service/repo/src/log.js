const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

// JSON lines on stdout. Callers pass structured fields, never whole request bodies or credentials.
export function createLogger({ level = 'info', stream = process.stdout } = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;
  const write = (lvl, message, fields = {}) => {
    if (LEVELS[lvl] < threshold) return;
    const line = { time: new Date().toISOString(), level: lvl, message, ...fields };
    stream.write(`${JSON.stringify(line)}\n`);
  };
  return {
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
  };
}

export const silentLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};
