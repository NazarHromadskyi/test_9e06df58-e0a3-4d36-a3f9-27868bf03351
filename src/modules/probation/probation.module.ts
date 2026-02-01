import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProbationService } from './probation.service';
import { ProbationClient } from './probation.client';
import { CsvReportParser } from '../../common/parsers/csv-report.parser';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  providers: [ProbationService, ProbationClient, CsvReportParser],
  exports: [ProbationService],
})
export class ProbationModule {}
