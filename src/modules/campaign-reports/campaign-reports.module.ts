import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignReportsController } from './campaign-reports.controller';
import { CampaignReportsService } from './campaign-reports.service';
import { CampaignReportRepository } from './repositories/campaign-report.repository';
import { CampaignReport } from './entities/campaign-report.entity';
import { ProbationModule } from '../probation/probation.module';

@Module({
  imports: [TypeOrmModule.forFeature([CampaignReport]), ProbationModule],
  controllers: [CampaignReportsController],
  providers: [CampaignReportsService, CampaignReportRepository],
  exports: [CampaignReportsService],
})
export class CampaignReportsModule {}
