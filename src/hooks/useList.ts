import { useState, useEffect, useCallback } from "react";
import type { ApiSuccessResponse } from "@/lib/api";
import { extractApiErrorMessage, type PaginatedData } from "@/lib/api-client";

export interface UseListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  [key: string]: string | number | undefined;
}

export function useList<T>(endpoint: string, options: UseListOptions = {}) {
  const [data, setData] = useState<PaginatedData<T> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(options.page || 1);
  const [pageSize, setPageSizeState] = useState(options.pageSize || 10);
  const [refreshKey, setRefreshKey] = useState(0);

  const restOptions = { ...options };
  delete restOptions.page;
  delete restOptions.pageSize;
  const optionsKey = JSON.stringify(restOptions);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));

        Object.entries(restOptions).forEach(([key, value]) => {
          if (value !== undefined) {
            params.set(key, String(value));
          }
        });

        const response = await fetch(`${endpoint}?${params}`);
        if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tải dữ liệu"));

        const result =
          (await response.json()) as ApiSuccessResponse<PaginatedData<T>>;
        if (!cancelled) setData(result.data);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to fetch data";
          setError(message);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, page, pageSize, optionsKey, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const setPageNumber = useCallback((p: number) => setPage(p), []);
  const setPageSize = useCallback((nextPageSize: number) => {
    setPageSizeState(nextPageSize);
    setPage(1);
  }, []);

  return {
    data,
    isLoading,
    error,
    page,
    pageSize,
    setPageNumber,
    setPageSize,
    refresh,
  };
}
