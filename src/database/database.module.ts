import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        autoLoadEntities: true,
        synchronize: false,
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: true,
        logging: configService.get<string>('nodeEnv') === 'development',
        // Connection pool configuration
        poolSize: 20,
        extra: {
          // Maximum time to wait for connection (in ms)
          connectionTimeoutMillis: 10000,
          // How long a client can remain idle before being closed (in ms)
          idleTimeoutMillis: 30000,
          // Maximum number of clients in pool
          max: 20,
        },
      }),
    }),
  ],
})
export class DatabaseModule {}
