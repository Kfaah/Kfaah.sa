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
 * Format a percentage to always display in English numerals (RTL: %100)
 */
export function formatPercent(value: number | string | null | undefined, decimals: number = 0): string {
  const num = Number(value) || 0;
  const formatted = new Intl.NumberFormat('en-US', { 
    useGrouping: false,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals 
  }).format(num);
  // RTL format: % before number
  return '%' + formatted;
}

/**
 * Format a date to display with English numerals (RTL: YYYY/MM/DD)
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  // RTL format: year/month/day
  return `${year}/${month}/${day}`;
}

/**
 * Format a date with time to display with English numerals (RTL format)
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  // RTL format: year/month/day hours:minutes
  return `${year}/${month}/${day} ${hours}:${minutes}`;
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
