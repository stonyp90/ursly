import { AuditLogQuery, AuditEventType } from '@ursly/shared/types';

export class AuditLogQueryBuilder {
  private query: AuditLogQuery = {};

  eventType(type: AuditEventType | AuditEventType[]): this {
    this.query.eventType = type as any;
    return this;
  }

  agentId(id: string): this {
    this.query.agentId = id;
    return this;
  }

  taskId(id: string): this {
    this.query.taskId = id;
    return this;
  }

  userId(id: string): this {
    this.query.userId = id;
    return this;
  }

  dateRange(start?: Date, end?: Date): this {
    if (start) {
      this.query.startDate = start;
    }
    if (end) {
      this.query.endDate = end;
    }
    return this;
  }

  pagination(limit: number, offset = 0): this {
    this.query.limit = limit;
    this.query.offset = offset;
    return this;
  }

  build(): AuditLogQuery {
    return { ...this.query };
  }

  static create(): AuditLogQueryBuilder {
    return new AuditLogQueryBuilder();
  }
}
