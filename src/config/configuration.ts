import { validateEnv, EnvConfig } from './env.validation';

/**
 * Application configuration factory.
 * Validates environment variables using Zod and returns typed configuration.
 */
export default (): {
  port: number;
  nodeEnv: string;
  redis: {
    host?: string;
    port: number;
    password?: string;
    db: number;
  };
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  probationApi: {
    url: string;
    apiKey: string;
  };
} => {
  const env: EnvConfig = validateEnv(process.env);

  return {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    redis: {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      db: env.REDIS_DB,
    },
    database: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      username: env.DB_USERNAME,
      password: env.DB_PASSWORD,
      database: env.DB_DATABASE,
    },
    probationApi: {
      url: env.PROBATION_API_URL,
      apiKey: env.PROBATION_API_KEY,
    },
  };
};
