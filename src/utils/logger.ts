import winston from "winston";

const isDev = process.env.NODE_ENV !== "production";

export const logger = winston.createLogger({
  level: isDev ? "debug" : "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "HH:mm:ss" }),
    winston.format.errors({ stack: true })
  ),
  transports: [
    new winston.transports.Console({
      format: isDev
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
              let log = `${timestamp} ${level}: ${message}`;
              if (stack) log += `\n${stack}`;
              const metaKeys = Object.keys(meta);
              if (metaKeys.length > 0) {
                log += `\n${JSON.stringify(meta, null, 2)}`;
              }
              return log;
            })
          )
        : winston.format.combine(winston.format.json()),
    }),
  ],
});
