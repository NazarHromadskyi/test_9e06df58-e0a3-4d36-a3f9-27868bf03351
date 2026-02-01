import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateCampaignReports1706700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.createTable(
      new Table({
        name: 'campaign_reports',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'campaign',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'campaign_id',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'adgroup',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'adgroup_id',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'ad',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'ad_id',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'client_id',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'event_name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'event_time',
            type: 'timestamptz',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'campaign_reports',
      new TableIndex({
        name: 'UQ_campaign_reports_event_time_client_id_event_name',
        columnNames: ['event_time', 'client_id', 'event_name'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'campaign_reports',
      new TableIndex({
        name: 'IDX_campaign_reports_ad_id_event_time',
        columnNames: ['ad_id', 'event_time'],
      }),
    );

    await queryRunner.createIndex(
      'campaign_reports',
      new TableIndex({
        name: 'IDX_campaign_reports_event_name',
        columnNames: ['event_name'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'campaign_reports',
      'IDX_campaign_reports_event_name',
    );
    await queryRunner.dropIndex(
      'campaign_reports',
      'IDX_campaign_reports_ad_id_event_time',
    );
    await queryRunner.dropIndex(
      'campaign_reports',
      'UQ_campaign_reports_event_time_client_id_event_name',
    );
    await queryRunner.dropTable('campaign_reports');
  }
}
