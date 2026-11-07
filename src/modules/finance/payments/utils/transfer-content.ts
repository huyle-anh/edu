// VietQR (EMVCo tag 62-08) allows at most 25 characters for the transfer content.
export const TRANSFER_CONTENT_MAX_LENGTH = 25;

const toAsciiUpper = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase();

/**
 * Builds the bank transfer content: batch reference first (statement matching looks for it),
 * then the student's short name and class names, cut to the VietQR limit.
 * Example: PB-20261021-600506, "Nguyễn Văn An", ["Toán 9A"] -> "PB20261021600506 NVAN TOA".
 */
export function buildTransferContent({
  batchNo,
  studentName,
  classNames,
}: {
  batchNo: string;
  studentName?: string | null;
  classNames?: Array<string | null | undefined>;
}) {
  const reference = toAsciiUpper(batchNo).replace(/[^A-Z0-9]/g, "");
  const words = toAsciiUpper(studentName ?? "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const shortName = words.length
    ? words.slice(0, -1).map((word) => word[0]).join("") + words[words.length - 1]
    : "";
  const classes = [
    ...new Set(
      (classNames ?? [])
        .map((name) => toAsciiUpper(name ?? "").replace(/[^A-Z0-9]/g, ""))
        .filter(Boolean),
    ),
  ].join(" ");
  return [reference, shortName, classes]
    .filter(Boolean)
    .join(" ")
    .slice(0, TRANSFER_CONTENT_MAX_LENGTH)
    .trim();
}
