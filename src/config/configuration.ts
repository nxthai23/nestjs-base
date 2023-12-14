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
});
