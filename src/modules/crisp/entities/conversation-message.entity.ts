import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { Conversation } from './conversation.entity';

@Entity('conversation_messages')
export class ConversationMessage {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int' })
  id: number;

  @Column({ name: 'fingerprint', type: 'bigint', unique: true })
  @Index('idx_fingerprint', { unique: true })
  fingerprint: number;

  @Column({ name: 'session_id', type: 'varchar', length: 255 })
  sessionId: string;

  @Column({ name: 'website_id', type: 'varchar', length: 255 })
  websiteId: string;

  @Column({ name: 'type', type: 'varchar', length: 50 })
  type: string;

  @Column({ name: 'from', type: 'varchar', length: 50 })
  from: string;

  @Column({ name: 'origin', type: 'varchar', length: 50, nullable: true })
  origin?: string;

  @Column({ name: 'content', type: 'text' })
  content: string;

  @Column({ name: 'user_id', type: 'varchar', length: 255, nullable: true })
  userId?: string;

  @Column({ name: 'user_nickname', type: 'varchar', length: 255, nullable: true })
  userNickname?: string;

  @Column({ name: 'preview', type: 'json', nullable: true })
  preview?: any[];

  @Column({ name: 'mentions', type: 'json', nullable: true })
  mentions?: any[];

  @Column({ name: 'read', type: 'varchar', length: 50, nullable: true })
  read?: string;

  @Column({ name: 'delivered', type: 'varchar', length: 50, nullable: true })
  delivered?: string;

  @Column({ name: 'stamped', type: 'boolean', default: false })
  stamped: boolean;

  @Column({ name: 'timestamp', type: 'bigint' })
  timestamp: number;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'session_id', referencedColumnName: 'sessionId' })
  conversation: Conversation;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

