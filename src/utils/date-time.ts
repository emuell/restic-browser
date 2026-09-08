// -------------------------------------------------------------------------------------------------

// Formats a date and time as unambiguous ISO-8601 like local date and time string,
// e.g. "2025-02-03 18:45".
export function formatDateTime(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) {
    return "";
  }
  const pad = (number: number) => String(number).padStart(2, "0");
  const day = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  const time = `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  return `${day} ${time}`;
}
