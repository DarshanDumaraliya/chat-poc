import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * AI-generated summary of a resolved conversation (from Anthropic Haiku 4.5).
 * One row per session_id; is_active mirrors completed_conversation.
 */
@Entity('completed_conversation_summary')
export class CompletedConversationSummary {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int' })
  id: number;

  @Column({ name: 'session_id', type: 'varchar', length: 255, unique: true })
  @Index('idx_completed_conversation_summary_session_id', { unique: true })
  sessionId: string;

  @Column({ name: 'summary', type: 'text', nullable: true })
  summary: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
