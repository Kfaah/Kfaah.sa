import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Wrap mixed-direction text (numbers + symbols) so it renders correctly in RTL UI.
 * Uses Unicode RTL isolate markers to prevent the browser from reordering segments.
 */
export function rtlIsolate(text: string): string {
  return `\u2067${text}\u2069`;
}

/**
 * Format a number to always display in English (Western Arabic) numerals
 */
export function formatNumber(value: number | string | null | undefined): string {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("en-US", { useGrouping: true }).format(num);
}

/**
 * Format a number without grouping (commas)
 */
export function formatNumberPlain(value: number | string | null | undefined): string {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("en-US", { useGrouping: false }).format(num);
}

/**
 * Format a percentage to always display in English numerals (RTL visual: %100)
 */
export function formatPercent(
  value: number | string | null | undefined,
  decimals: number = 0
): string {
  const num = Number(value) || 0;
  const formatted = new Intl.NumberFormat("en-US", {
    useGrouping: false,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);

  return rtlIsolate("%" + formatted);
}

/**
 * Convert Gregorian date to Hijri date
 */
export function toHijri(date: Date): { year: number; month: number; day: number } {
  const jd = Math.floor((date.getTime() - new Date(1970, 0, 1).getTime()) / 86400000) + 2440588;
  const l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) + Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l3) / 709);
  const day = l3 - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { year, month, day };
}

/**
 * Format a date to display with English numerals.
 * Note: we isolate to avoid LTR flipping inside RTL layouts.
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return rtlIsolate(`${day} / ${month} / ${year}`);
}

/**
 * Format a date to display Gregorian and Hijri dates
 */
export function formatDateWithHijri(date: Date | string | null | undefined): { gregorian: string; hijri: string } {
  if (!date) return { gregorian: "-", hijri: "-" };
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return { gregorian: "-", hijri: "-" };

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  const hijri = toHijri(d);
  const hijriDay = String(hijri.day).padStart(2, "0");
  const hijriMonth = String(hijri.month).padStart(2, "0");

  return {
    gregorian: rtlIsolate(`${day}/${month}/${year}`),
    hijri: rtlIsolate(`${hijriDay}/${hijriMonth}/${hijri.year}`)
  };
}

/**
 * Format a date with time to display with English numerals.
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return rtlIsolate(`${day} / ${month} / ${year} ${hours}:${minutes}`);
}

/**
 * Normalize numeric input - convert Arabic/Persian digits to English
 */
export function normalizeNumericInput(value: string): string {
  const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
  const easternArabicIndic = "۰۱۲۳۴۵۶۷۸۹";

  return value
    .replace(/[٠-٩]/g, (d) => String(arabicIndic.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(easternArabicIndic.indexOf(d)))
    .replace(/[^0-9.-]/g, "");
}
