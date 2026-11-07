const DIGITS = [
  "không",
  "một",
  "hai",
  "ba",
  "bốn",
  "năm",
  "sáu",
  "bảy",
  "tám",
  "chín",
];

const GROUPS = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ", "tỷ tỷ"];

function readThreeDigits(value: number, full: boolean) {
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  const tens = Math.floor(remainder / 10);
  const ones = remainder % 10;
  const words: string[] = [];

  if (hundreds > 0) {
    words.push(`${DIGITS[hundreds]} trăm`);
  } else if (full && remainder > 0) {
    words.push("không trăm");
  }

  if (tens > 1) {
    words.push(`${DIGITS[tens]} mươi`);
    if (ones === 1) words.push("mốt");
    else if (ones === 4) words.push("tư");
    else if (ones === 5) words.push("lăm");
    else if (ones > 0) words.push(DIGITS[ones] ?? "");
  } else if (tens === 1) {
    words.push("mười");
    if (ones === 5) words.push("lăm");
    else if (ones > 0) words.push(DIGITS[ones] ?? "");
  } else if (ones > 0) {
    if (hundreds > 0 || full) words.push("lẻ");
    words.push(DIGITS[ones] ?? "");
  }

  return words.join(" ");
}

export function vietnameseAmountInWords(value: number | string) {
  const normalized = String(value).replace(/,/g, "").trim();
  const integerPart = normalized.split(".")[0] || "0";
  const digits = integerPart.replace(/^0+(?=\d)/, "");
  if (!/^\d+$/.test(digits)) return "Không đồng chẵn";
  if (digits === "0") return "Không đồng chẵn";

  const groups: number[] = [];
  let remaining = digits;
  while (remaining.length > 0) {
    const start = Math.max(0, remaining.length - 3);
    groups.unshift(Number(remaining.slice(start)));
    remaining = remaining.slice(0, start);
  }

  const highestGroup = groups.findIndex((group) => group > 0);
  const words = groups
    .map((group, index) => {
      if (group === 0) return "";
      const groupIndex = groups.length - 1 - index;
      const part = readThreeDigits(group, index > highestGroup);
      return `${part}${GROUPS[groupIndex] ? ` ${GROUPS[groupIndex]}` : ""}`;
    })
    .filter(Boolean)
    .join(" ");

  return `${words.charAt(0).toUpperCase()}${words.slice(1)} đồng chẵn`;
}
