import type { ApiErrorResponse, ApiSuccessResponse } from "@/lib/api";

export type PaginatedData<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

export async function parseApiResponse<T>(
  response: Response,
): Promise<ApiSuccessResponse<T> | ApiErrorResponse> {
  return response.json();
}

export async function unwrapApiResponse<T>(response: Response): Promise<T> {
  const payload = await parseApiResponse<T>(response);
  if (!payload.success) {
    throw new Error(payload.error.message);
  }
  return payload.data;
}

export async function extractApiErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const payload = (await response.json()) as ApiErrorResponse;
    return payload.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}
