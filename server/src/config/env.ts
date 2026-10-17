import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/inventory_erp'),
  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET must be at least 16 characters long')
    .default('super_secret_jwt_key_at_least_32_characters_long_for_security_compliance'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:4200'),
  ADMIN_NAME: z.string().default('System Administrator'),
  ADMIN_EMAIL: z.string().email().default('admin@inventory.local'),
  ADMIN_PASSWORD: z.string().min(6).default('Admin@123456'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const ENV = parsedEnv.data;
