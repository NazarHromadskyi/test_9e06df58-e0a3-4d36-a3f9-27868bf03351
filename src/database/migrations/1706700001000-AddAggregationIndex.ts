import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

/**
 * Migration to add composite index for aggregation queries.
 *
 * The aggregation query filters by event_name and event_time range,
 * so a composite index on (event_name, event_time) is optimal for:
 * - Fast equality lookup on event_name
 * - Efficient range scan on event_time within that event_name partition
 */
export class AddAggregationIndex1706700001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndex(
      'campaign_reports',
      new TableIndex({
        name: 'IDX_campaign_reports_event_name_event_time',
        columnNames: ['event_name', 'event_time'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'campaign_reports',
      'IDX_campaign_reports_event_name_event_time',
    );
  }
}
