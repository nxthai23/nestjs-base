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
  caching: {
    // 'memory' | 'redis' | 'valkey' | 'memcached'
    driver: process.env.CACHE_DRIVER || 'memory',
    ttl: parseInt(process.env.CACHE_TTL) || 60, // seconds
    // memory driver only: entries held before the coldest is evicted
    maxEntries: parseInt(process.env.CACHE_MAX_ENTRIES) || 10000,
    redis: {
      url: process.env.REDIS_URL,
    },
    valkey: {
      url: process.env.VALKEY_URL,
    },
    memcached: {
      servers: process.env.MEMCACHED_SERVERS, // "host:11211,host2:11211"
      username: process.env.MEMCACHED_USERNAME,
      password: process.env.MEMCACHED_PASSWORD,
    },
  },
  isEnableSeeder: parseInt(process.env.ENABLE_SEEDER) || 0,
  storage: {
    driver: process.env.STORAGE_DRIVER || 's3', // 's3' or 'r2'
    s3: {
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
    r2: {
      bucket: process.env.R2_BUCKET,
      accountId: process.env.R2_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  },
});
