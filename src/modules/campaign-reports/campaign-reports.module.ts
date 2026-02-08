import { Module } from '@nestjs/common';
import { CampaignReportsController } from './campaign-reports.controller';
import { CampaignReportsCoreModule } from './campaign-reports-core.module';

@Module({
  imports: [CampaignReportsCoreModule],
  controllers: [CampaignReportsController],
  exports: [CampaignReportsCoreModule],
})
export class CampaignReportsModule {}
