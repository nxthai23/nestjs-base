import { Params } from 'nestjs-pino';

export const loggerConfig: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss.l',
              ignore: 'pid,hostname,app,version,env,context',
              singleLine: true,
              messageFormat: '[{context}] - {msg}',
            },
          }
        : undefined,

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

    // Custom log message
    customLogLevel: (req: any, res: any, err: any) => {
      if (res.statusCode >= 400 && res.statusCode < 500) return 'warn';
      if (res.statusCode >= 500 || err) return 'error';
      return 'info';
    },

    customSuccessMessage: (req: any, res: any) => {
      return `${req.method} ${req.url} ${res.statusCode}`;
    },

    customErrorMessage: (req: any, res: any, err: any) => {
      return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
    },
  },
};
