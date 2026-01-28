import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ConversationMessage } from './conversation-message.entity';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int' })
  id: number;

  @Column({ name: 'session_id', type: 'varchar', length: 255, unique: true })
  @Index('idx_session_id', { unique: true })
  sessionId: string;

  @Column({ name: 'website_id', type: 'varchar', length: 255 })
  websiteId: string;

  @Column({ name: 'active_last', type: 'bigint', nullable: true })
  activeLast?: number;

  @Column({ name: 'active_now', type: 'boolean', default: false })
  activeNow: boolean;

  @Column({ name: 'availability', type: 'varchar', length: 50, nullable: true })
  availability?: string;

  @Column({ name: 'created_at_crisp', type: 'bigint' })
  createdAtCrisp: number;

  @Column({ name: 'is_blocked', type: 'boolean', default: false })
  isBlocked: boolean;

  @Column({ name: 'mentions', type: 'json', nullable: true })
  mentions?: any[];

  // Meta fields
  @Column({ name: 'meta_nickname', type: 'varchar', length: 255, nullable: true })
  metaNickname?: string;

  @Column({ name: 'meta_email', type: 'varchar', length: 255, nullable: true })
  metaEmail?: string;

  @Column({ name: 'meta_phone', type: 'varchar', length: 50, nullable: true })
  metaPhone?: string;

  @Column({ name: 'meta_avatar', type: 'text', nullable: true })
  metaAvatar?: string;

  @Column({ name: 'meta_ip', type: 'varchar', length: 100, nullable: true })
  metaIp?: string;

  @Column({ name: 'meta_origin', type: 'varchar', length: 100, nullable: true })
  metaOrigin?: string;

  @Column({ name: 'meta_segments', type: 'json', nullable: true })
  metaSegments?: any[];

  @Column({ name: 'meta_data', type: 'json', nullable: true })
  metaData?: any;

  @Column({ name: 'meta_device', type: 'json', nullable: true })
  metaDevice?: any;

  @Column({ name: 'meta_connection', type: 'json', nullable: true })
  metaConnection?: any;

  @Column({ name: 'participants', type: 'json', nullable: true })
  participants?: any[];

  @Column({ name: 'state', type: 'varchar', length: 50, nullable: true })
  state?: string;

  @Column({ name: 'status', type: 'int', default: 0 })
  status: number;

  @Column({ name: 'unread_operator', type: 'int', default: 0 })
  unreadOperator: number;

  @Column({ name: 'unread_visitor', type: 'int', default: 0 })
  unreadVisitor: number;

  @Column({ name: 'updated_at_crisp', type: 'bigint' })
  updatedAtCrisp: number;

  @Column({ name: 'verifications', type: 'json', nullable: true })
  verifications?: any[];

  @Column({ name: 'last_message', type: 'text', nullable: true })
  lastMessage?: string;

  @Column({ name: 'preview_message_type', type: 'varchar', length: 50, nullable: true })
  previewMessageType?: string;

  @Column({ name: 'preview_message_from', type: 'varchar', length: 50, nullable: true })
  previewMessageFrom?: string;

  @Column({ name: 'preview_message_excerpt', type: 'text', nullable: true })
  previewMessageExcerpt?: string;

  @Column({ name: 'preview_message_fingerprint', type: 'bigint', nullable: true })
  previewMessageFingerprint?: number;

  @Column({ name: 'waiting_since', type: 'bigint', nullable: true })
  waitingSince?: number;

  @Column({ name: 'assigned_user_id', type: 'varchar', length: 255, nullable: true })
  assignedUserId?: string;

  @Column({ name: 'people_id', type: 'varchar', length: 255, nullable: true })
  peopleId?: string;

  @Column({ name: 'compose', type: 'json', nullable: true })
  compose?: any;

  @OneToMany(() => ConversationMessage, (message) => message.conversation)
  messages: ConversationMessage[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

