import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bullmq';
import type { CacheManagerOptions } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
import configuration from '../config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): CacheManagerOptions => {
        const ttl = 300000; // 5 minutes
        const redisHost = configService.get<string>('redis.host');

        if (!redisHost) {
          return { ttl } satisfies CacheManagerOptions;
        }

        const redisPort = configService.get<number>('redis.port') ?? 6379;
        const redisPassword = configService.get<string>('redis.password');
        const redisDb = configService.get<number>('redis.db') ?? 0;

        const redisUrl = new URL(
          `redis://${redisHost}:${redisPort}/${redisDb}`,
        );
        if (redisPassword) {
          redisUrl.password = redisPassword;
        }

        return {
          ttl,
          namespace: 'campaign-reports',
          stores: [new KeyvRedis(redisUrl.toString())],
        } satisfies CacheManagerOptions;
      },
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisHost =
          configService.get<string>('redis.host') ?? '127.0.0.1';
        const redisPort = configService.get<number>('redis.port') ?? 6379;
        const redisPassword = configService.get<string>('redis.password');
        const redisDb = configService.get<number>('redis.db') ?? 0;

        return {
          prefix: 'campaign-reports',
          connection: {
            host: redisHost,
            port: redisPort,
            password: redisPassword,
            db: redisDb,
          },
          defaultJobOptions: {
            removeOnComplete: { count: 1000 },
            removeOnFail: { count: 1000 },
          },
        };
      },
    }),
  ],
})
export class InfrastructureModule {}
