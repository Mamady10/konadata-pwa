import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "GNF"): string {
  return new Intl.NumberFormat("fr-GN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("fr-FR").format(num);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
