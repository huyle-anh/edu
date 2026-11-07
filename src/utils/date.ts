export const intToTime = (value: number): string => {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
};

export function clampMonth(
  value: string,
  minMonth?: string | null,
  maxMonth?: string | null,
): string {
  if (minMonth && value < minMonth) return minMonth;
  if (maxMonth && value > maxMonth) return maxMonth;
  return value;
}
