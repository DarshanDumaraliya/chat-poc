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
  }
  