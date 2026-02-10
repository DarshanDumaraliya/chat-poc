import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Stores a snapshot of a conversation when its state becomes "resolved".
 * session_json holds full session details and all messages (no length limit in app logic).
 */
@Entity('completed_conversations')
export class CompletedConversation {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int' })
  id: number;

  @Column({ name: 'session_id', type: 'varchar', length: 255, unique: true })
  @Index('idx_completed_conversation_session_id', { unique: true })
  sessionId: string;  

  /** Full session details + all messages: { session: {...}, messages: [...] } */
  @Column({ name: 'session_json', type: 'json', nullable: false })
  sessionJson: Record<string, any>;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
