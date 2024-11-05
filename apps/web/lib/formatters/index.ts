import { format } from "date-fns";

const formatter0DecimalPlaces = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export function formatPercent(value: number) {
  return `${formatter0DecimalPlaces.format(Math.abs(value) * 100)}%`;
}

export function formatGridTime(dateTime: Date) {
  return format(dateTime, "yyyy-MM-dd HH:mm");
}
