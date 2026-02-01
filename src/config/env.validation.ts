import { z } from 'zod';

/**
 * Environment variables validation schema.
 * Uses Zod for type-safe validation with fail-fast behavior.
 */
export const envSchema = z.object({
  // Application
  PORT: z.coerce.number().positive().default(3000),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Database
  DB_HOST: z.string().min(1, 'DB_HOST is required'),
  DB_PORT: z.coerce.number().positive().default(5432),
  DB_USERNAME: z.string().min(1, 'DB_USERNAME is required'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),
  DB_DATABASE: z.string().min(1, 'DB_DATABASE is required'),

  // Probation API
  PROBATION_API_URL: z
    .string()
    .url()
    .default('https://probation.impulseapi.link'),
  PROBATION_API_KEY: z
    .string()
    .min(
      1,
      'PROBATION_API_KEY is required - application cannot function without it',
    ),
});

/**
 * Inferred type from the Zod schema for type-safe config access.
 */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates environment variables against the schema.
 * Throws detailed error on validation failure for fail-fast behavior.
 *
 * @param config - Raw environment variables
 * @returns Validated and typed configuration
 */
export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Environment validation failed:\n${errors}\n\nPlease check your .env file or environment variables.`,
    );
  }

  return result.data;
}
