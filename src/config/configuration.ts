/**
 * @description Configuration file for the application
 * @see https://docs.nestjs.com/techniques/configuration
 */

export default () => ({
  saltRound: parseInt(process.env.SALT_ROUND),
  local: process.env.LOCAL,
  database: {
    mongoUri: process.env.MONGODB_URI,
    mongoDbName: process.env.MONGO_DB_NAME,
  },
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiration: process.env.JWT_EXPIRATION,
  appPort: parseInt(process.env.APP_PORT),
  dbType: process.env.DB_TYPE,
  nodeEnv: process.env.NODE_ENV,
  // mongo
  mongoUri: process.env.MONGODB_URI,
  mongoDbName: process.env.MONGO_DB_NAME,
  // postgres
  postgresHost: process.env.POSTGRES_HOST,
  postgresPort: process.env.POSTGRES_PORT,
  postgresUser: process.env.POSTGRES_USER,
  postgresPassword: process.env.POSTGRES_PASSWORD,
  postgresDbName: process.env.POSTGRES_DB_NAME,
});
