import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { CampaignReportsService } from './campaign-reports.service';
import { CampaignReportRepository } from './repositories/campaign-report.repository';
import { CampaignReport } from './entities/campaign-report.entity';
import { ProbationModule } from '../probation/probation.module';
import { CampaignReportsCacheService } from './campaign-reports-cache.service';
import { CAMPAIGN_REPORTS_FETCH_QUEUE } from './jobs/campaign-reports-fetch.constants';
import { CampaignReportsFetchJobsService } from './jobs/campaign-reports-fetch-jobs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CampaignReport]),
    ProbationModule,
    BullModule.registerQueue({
      name: CAMPAIGN_REPORTS_FETCH_QUEUE,
    }),
  ],
  providers: [
    CampaignReportsService,
    CampaignReportsCacheService,
    CampaignReportRepository,
    CampaignReportsFetchJobsService,
  ],
  exports: [CampaignReportsService, CampaignReportsFetchJobsService],
})
export class CampaignReportsCoreModule {}
