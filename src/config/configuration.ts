/**
 * @description Configuration file for the application
 * @see https://docs.nestjs.com/techniques/configuration
 */

export default () => ({
  saltRound: parseInt(process.env.SALT_ROUND),
  local: process.env.LOCAL,
  database: {
    // config
    minPoolSize: parseInt(process.env.MIN_POOL_SIZE) || 1,
    maxPoolSize: parseInt(process.env.MAX_POOL_SIZE) || 2,
    // mongo db
    mongoUri: process.env.MONGO_URI,
    mongoDbName: process.env.MONGO_DB_NAME,

    // postgresql
    // postgres
    postgresHost: process.env.POSTGRES_HOST,
    postgresPort: process.env.POSTGRES_PORT,
    postgresUser: process.env.POSTGRES_USER,
    postgresPassword: process.env.POSTGRES_PASSWORD,
    postgresDbName: process.env.POSTGRES_DB_NAME,
  },
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiration: process.env.JWT_EXPIRATION,
  appPort: parseInt(process.env.APP_PORT) || 8080,
  dbType: process.env.DB_TYPE,
  nodeEnv: process.env.NODE_ENV,
  redis: {
    url: process.env.REDIS_URL,
    ttl: parseInt(process.env.REDIS_TTL) || 60 * 1000, // Default 1 minute in ms
    type: process.env.REDIS_TYPE || 'single', // 'single' or 'cluster'
  },
  isEnableSeeder: parseInt(process.env.ENABLE_SEEDER) || 0,
});
