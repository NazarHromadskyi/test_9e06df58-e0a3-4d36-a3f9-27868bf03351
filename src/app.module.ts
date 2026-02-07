import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { CacheManagerOptions } from '@nestjs/cache-manager';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { CampaignReportsModule } from './modules/campaign-reports/campaign-reports.module';
import { ProbationModule } from './modules/probation/probation.module';
import { HealthModule } from './modules/health/health.module';
import { RedisKeyvStore } from './common/cache/redis-keyv.store';

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

        return {
          ttl,
          namespace: 'campaign-reports',
          stores: [
            new RedisKeyvStore({
              host: redisHost,
              port: redisPort,
              password: redisPassword,
              db: redisDb,
            }),
          ],
        } satisfies CacheManagerOptions;
      },
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 10, // 10 requests per second
      },
      {
        name: 'medium',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
      {
        name: 'long',
        ttl: 3600000, // 1 hour
        limit: 1000, // 1000 requests per hour
      },
    ]),
    DatabaseModule,
    CampaignReportsModule,
    ProbationModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
