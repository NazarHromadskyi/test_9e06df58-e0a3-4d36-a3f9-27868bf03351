import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrapWorker() {
  const logger = new Logger('WorkerBootstrap');

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['log', 'warn', 'error'],
  });

  const shutdown = async () => {
    logger.log('Shutting down worker...');
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  logger.log('Worker is running and waiting for jobs...');
}

void bootstrapWorker();
