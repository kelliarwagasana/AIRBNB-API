import chalk, { type ChalkInstance } from "chalk";

const timestamp = () => new Date().toISOString();

const formatMessage = (level: string, color: ChalkInstance, message: string, meta?: unknown) => {
  const time = chalk.gray(timestamp());
  const levelStr = color(`[${level.toUpperCase()}]`);
  
  let log = `${time} ${levelStr} ${message}`;
  
  if (meta) {
    log += `\n${chalk.gray(JSON.stringify(meta, null, 2))}`;
  }
  
  return log;
};

export const logger = {
  info: (message: string, meta?: unknown) => {
    console.log(formatMessage("info", chalk.blue, message, meta));
  },
  
  success: (message: string, meta?: unknown) => {
    console.log(formatMessage("success", chalk.green, message, meta));
  },
  
  warn: (message: string, meta?: unknown) => {
    console.warn(formatMessage("warn", chalk.yellow, message, meta));
  },
  
  error: (message: string, meta?: unknown) => {
    console.error(formatMessage("error", chalk.red, message, meta));
  },
  
  debug: (message: string, meta?: unknown) => {
    if (process.env.NODE_ENV === "development") {
      console.log(formatMessage("debug", chalk.magenta, message, meta));
    }
  },
  
  // HTTP request logger
  http: (method: string, path: string, statusCode: number, duration: number) => {
    const statusColor = statusCode >= 400 ? chalk.red : statusCode >= 300 ? chalk.yellow : chalk.green;
    console.log(
      `${chalk.gray(timestamp())} ${chalk.blue(method.padEnd(7))} ${path.padEnd(30)} ${statusColor(statusCode)} ${chalk.gray(duration + "ms")}`
    );
  },
};

export default logger;
