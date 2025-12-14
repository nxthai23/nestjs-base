import { Params } from 'nestjs-pino';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import * as rfs from 'rotating-file-stream';
import * as pino from 'pino';

const logDir = join(process.cwd(), 'logs');

// Ensure log directory exists
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

export const infoLogStream = rfs.createStream(
  (time) => {
    if (!time) return 'info.log';
    const date = time.toString().split('T')[0];
    return `info-${date}.log`;
  },
  {
    interval: '1d',
    path: logDir,
    maxFiles: 45, // keep 45 days
    compress: 'gzip',
  },
);

export const errorLogStream = rfs.createStream(
  (time) => {
    if (!time) return 'error.log';
    const date = time.toString().split('T')[0];
    return `error-${date}.log`;
  },
  {
    interval: '1d',
    path: logDir,
    maxFiles: 45,
    compress: 'gzip',
  },
);

export const loggerConfig: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL || 'info',
    // Use multistream for both console and file output
    stream: pino.multistream([
      {
        level: 'info',
        stream:
          process.env.NODE_ENV !== 'production'
            ? pino.transport({
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'HH:MM:ss.l',
                  ignore:
                    'pid,hostname,app,version,env,context,req,res,responseTime',
                  singleLine: false,
                  messageFormat: '{msg}',
                },
              })
            : process.stdout,
      },
      { level: 'info', stream: infoLogStream },
      { level: 'error', stream: errorLogStream },
    ]),

    // Production JSON format
    formatters: {
      level: (label: string) => {
        return { level: label };
      },
    },

    // Base fields for all logs
    base: {
      env: process.env.NODE_ENV,
      app: process.env.APP_NAME || 'nestjs-app',
      version: process.env.APP_VERSION || '1.0.0',
    },

    // Customize log serialization
    serializers: {
      req: (req: any) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        query: req.query,
        params: req.params,
        headers: {
          host: req.headers.host,
          'user-agent': req.headers['user-agent'],
          'x-request-id': req.headers['x-request-id'],
        },
        remoteAddress: req.remoteAddress,
        remotePort: req.remotePort,
      }),
      res: (res: any) => ({
        statusCode: res.statusCode,
        headers: {
          'content-type': res.headers['content-type'],
          'content-length': res.headers['content-length'],
        },
      }),
      err: (err: any) => ({
        type: err.type,
        message: err.message,
        stack: err.stack,
        code: err.code,
      }),
    },

    // Auto-log requests
    autoLogging: {
      ignore: (req: any) => {
        // Don't log health checks
        return req.url === '/health' || req.url === '/metrics';
      },
    },

    // Custom log level based on status code
    customLogLevel: (req: any, res: any, err: any) => {
      if (res.statusCode >= 400 && res.statusCode < 500) return 'warn';
      if (res.statusCode >= 500 || err) return 'error';
      return 'info';
    },

    // Custom formatted message
    customSuccessMessage: (req: any, res: any) => {
      // Calculate response time
      const startTime =
        req[Symbol.for('pino-http-start')] ||
        req[Symbol.for('request-started')];
      const responseTime = startTime ? Date.now() - startTime : 0;
      const remoteAddr =
        req.socket?.remoteAddress ||
        req.connection?.remoteAddress ||
        req.ip ||
        'unknown';

      return `${req.method} | ${req.url} | ${res.statusCode} | ${
        req.headers['user-agent'] || 'N/A'
      } | ${remoteAddr} | ${responseTime}ms`;
    },

    customErrorMessage: (req: any, res: any, err: any) => {
      // Calculate response time
      const startTime =
        req[Symbol.for('pino-http-start')] ||
        req[Symbol.for('request-started')];
      const responseTime = startTime ? Date.now() - startTime : 0;
      const remoteAddr =
        req.socket?.remoteAddress ||
        req.connection?.remoteAddress ||
        req.ip ||
        'unknown';

      return `${req.method} | ${req.url} | ${res.statusCode} | ${
        req.headers['user-agent'] || 'N/A'
      } | ${remoteAddr} | ${responseTime}ms | Error: ${err.message}`;
    },
  },
};
