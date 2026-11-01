import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";

export type NoticeFeeStatus = "UNPAID" | "PARTIAL" | "OVERDUE";

export type NoticeFee = {
  id: string;
  feeNo: string;
  billingYear: number;
  billingMonth: number;
  finalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: NoticeFeeStatus;
  student: { id: string; code: string; fullName: string };
  class: { id: string; name: string; code: string };
  items: Array<{ itemName: string; amount: number }>;
  paymentAllocations?: Array<{
    paymentBatch: { id: string; batchNo: string; status: string };
  }>;
};

export type PendingBatch = {
  id: string;
  batchNo: string;
  totalAmount: number;
  paymentMethod: string;
  bankAccountId: string | null;
  student: { id: string; code: string; fullName: string };
  allocations: Array<{
    amount: number;
    tuitionFee: {
      id: string;
      feeNo: string;
      billingYear: number;
      billingMonth: number;
      class: { id: string; name: string; code: string } | null;
    };
  }>;
};

export type NoticeBankAccount = {
  id: string;
  bankName: string;
  accountNo: string;
  accountName: string;
};

export type NoticePage<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pagination: { total: number; totalPages: number };
};

export type NoticeListFilters = {
  month: string;
  page: number;
  pageSize: number;
  search: string;
  studentId?: string;
  classId?: string;
};

export type NoticePdfScope = {
  month?: string;
  classId?: string;
};

export async function fetchAllNoticePages<T>(
  fetcher: (filters: NoticeListFilters) => Promise<NoticePage<T>>,
  filters: NoticeListFilters,
) {
  const pageSize = 100;
  const firstPage = await fetcher({ ...filters, page: 1, pageSize });
  const pages: NoticePage<T>[] = [firstPage];
  const batchSize = 10;

  for (
    let firstPageNumber = 2;
    firstPageNumber <= firstPage.pagination.totalPages;
    firstPageNumber += batchSize
  ) {
    const pageNumbers = Array.from(
      {
        length: Math.min(
          batchSize,
          firstPage.pagination.totalPages - firstPageNumber + 1,
        ),
      },
      (_, index) => firstPageNumber + index,
    );
    pages.push(
      ...(await Promise.all(
        pageNumbers.map((page) =>
          fetcher({ ...filters, page, pageSize }),
        ),
      )),
    );
  }

  return {
    ...firstPage,
    items: pages.flatMap((page) => page.items),
    page: 1,
    pageSize: Math.max(firstPage.total, pageSize),
  };
}

function buildListQuery(filters: NoticeListFilters) {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  });
  if (filters.month) params.set("month", filters.month);
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.studentId) params.set("studentId", filters.studentId);
  if (filters.classId) params.set("classId", filters.classId);
  return params;
}

async function fetchPage<T>(endpoint: string): Promise<NoticePage<T>> {
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(
      await extractApiErrorMessage(response, "Không thể tải dữ liệu"),
    );
  }
  return unwrapApiResponse<NoticePage<T>>(response);
}

export async function fetchOutstandingFees(filters: NoticeListFilters) {
  const query = buildListQuery(filters);
  query.set("statuses", ["UNPAID", "PARTIAL", "OVERDUE"].join(","));
  query.set("unissuedOnly", "true");
  return fetchPage<NoticeFee>(`/api/tuition-fees?${query}`);
}

export async function fetchPaymentBatches(
  status: "PENDING" | "SUCCESS",
  filters: NoticeListFilters,
) {
  const query = buildListQuery(filters);
  query.set("status", status);
  return fetchPage<PendingBatch>(`/api/payment-batches?${query}`);
}

export async function fetchPendingBatches(filters: NoticeListFilters) {
  return fetchPaymentBatches("PENDING", filters);
}

export async function fetchSuccessfulBatches(filters: NoticeListFilters) {
  return fetchPaymentBatches("SUCCESS", filters);
}

export async function fetchNoticeBankAccounts() {
  const response = await fetch("/api/bank-accounts");
  if (!response.ok) {
    throw new Error(
      await extractApiErrorMessage(
        response,
        "Không thể tải tài khoản ngân hàng",
      ),
    );
  }
  return unwrapApiResponse<NoticeBankAccount[]>(response);
}

export async function issueNoticeBatches(input: {
  tuitionFeeIds: string[];
  mode: "BY_STUDENT";
  bankAccountId: string;
  idempotencyKey: string;
}) {
  const response = await fetch("/api/payment-batches/notice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(
      await extractApiErrorMessage(
        response,
        "Không thể phát hành thông báo học phí",
      ),
    );
  }
  return unwrapApiResponse<{
    batches: Array<{ id: string; batchNo: string; totalAmount: number }>;
  }>(response);
}

export async function issueClassNoticeBatches(input: {
  classId: string;
  month: string;
  bankAccountId: string;
  idempotencyKey: string;
}) {
  const response = await fetch("/api/payment-batches/notice/class", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(
      await extractApiErrorMessage(
        response,
        "Không thể phát hành thông báo theo lớp",
      ),
    );
  }
  return unwrapApiResponse<{
    batches: Array<{ id: string; batchNo: string; totalAmount: number }>;
    replacedBatchCount: number;
    updatedBatchCount: number;
  }>(response);
}

export async function downloadNoticeBatchesPdf(
  batchIds: string[],
  scope?: NoticePdfScope,
) {
  const response = await fetch("/api/payment-batches/notice/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ batchIds, ...(scope ? { scope } : {}) }),
  });
  if (!response.ok) {
    throw new Error(
      await extractApiErrorMessage(response, "Không thể tải PDF thông báo"),
    );
  }
  return response.blob();
}

export async function restructurePendingBatches(
  input:
    | {
        operation: "SPLIT";
        sourceBatchId: string;
        reason: string;
        idempotencyKey: string;
      }
    | {
        operation: "MERGE";
        batchIds: string[];
        reason: string;
        idempotencyKey: string;
      },
) {
  const response = await fetch("/api/payment-batches/restructure", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(
      await extractApiErrorMessage(
        response,
        "Không thể tách hoặc gộp đợt thanh toán",
      ),
    );
  }
  return unwrapApiResponse<{
    batches: Array<{ id: string; batchNo: string; totalAmount: number }>;
  }>(response);
}
