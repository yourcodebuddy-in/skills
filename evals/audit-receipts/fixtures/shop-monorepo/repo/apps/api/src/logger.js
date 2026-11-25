const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

export const createLogger = ({ level = "info", write = (line) => process.stdout.write(`${line}\n`) } = {}) => {
  const threshold = LEVELS[level] ?? LEVELS.info;
  const log = (name) => (event, fields = {}) => {
    if (LEVELS[name] < threshold) {
      return;
    }
    write(JSON.stringify({ time: new Date().toISOString(), level: name, event, ...fields }));
  };
  return { debug: log("debug"), info: log("info"), warn: log("warn"), error: log("error") };
};

export const silentLogger = { debug() {}, info() {}, warn() {}, error() {} };
