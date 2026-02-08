import { Module } from '@nestjs/common';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { DatabaseModule } from './database/database.module';
import { CampaignReportsCoreModule } from './modules/campaign-reports/campaign-reports-core.module';
import { CampaignReportsFetchProcessor } from './modules/campaign-reports/jobs/campaign-reports-fetch.processor';

@Module({
  imports: [InfrastructureModule, DatabaseModule, CampaignReportsCoreModule],
  providers: [CampaignReportsFetchProcessor],
})
export class WorkerModule {}
