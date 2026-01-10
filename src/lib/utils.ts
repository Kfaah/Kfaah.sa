import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number to always display in English (Western Arabic) numerals
 */
export function formatNumber(value: number | string | null | undefined): string {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('en-US', { useGrouping: true }).format(num);
}

/**
 * Format a number without grouping (commas)
 */
export function formatNumberPlain(value: number | string | null | undefined): string {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('en-US', { useGrouping: false }).format(num);
}

/**
 * Format a percentage to always display in English numerals
 */
export function formatPercent(value: number | string | null | undefined, decimals: number = 0): string {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('en-US', { 
    useGrouping: false,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals 
  }).format(num) + '%';
}

/**
 * Format a date to display with English numerals
 */
export function formatDate(date: Date | string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  
  return new Intl.DateTimeFormat('en-US', options || defaultOptions).format(d);
}

/**
 * Format a date with time to display with English numerals
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  
  return new Intl.DateTimeFormat('en-US', {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
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
