export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

export interface PaginationParams {
  limit: number;
  offset: number;
}