import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';

@Entity('campaign_reports')
@Unique(['event_time', 'client_id', 'event_name'])
@Index(['ad_id', 'event_time'])
@Index(['event_name'])
export class CampaignReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  campaign: string;

  @Column({ type: 'varchar', length: 255 })
  campaign_id: string;

  @Column({ type: 'varchar', length: 255 })
  adgroup: string;

  @Column({ type: 'varchar', length: 255 })
  adgroup_id: string;

  @Column({ type: 'varchar', length: 255 })
  ad: string;

  @Column({ type: 'varchar', length: 255 })
  ad_id: string;

  @Column({ type: 'varchar', length: 255 })
  client_id: string;

  @Column({ type: 'varchar', length: 100 })
  event_name: string;

  @Column({ type: 'timestamptz' })
  event_time: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
