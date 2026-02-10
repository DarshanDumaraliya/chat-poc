// Common response interface
export interface APIResponseInterface<T> {
  code?: number;
  message?: string;
  data?: T;
  pagination?: Pagination;
}
export interface Pagination {
  total: number;
  page: number;
  pageParRecord: number;
  /** Total conversations with state === 'resolved' (for conversation list) */
  resolvedCount?: number;
  /** Total conversations not resolved (for conversation list) */
  unresolvedCount?: number;
}
