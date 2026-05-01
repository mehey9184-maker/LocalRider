import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getEstimatedMinutes(km: number, speedKmph: number = 20) {
  if (!km || km <= 0) return 2;
  const hours = km / speedKmph;
  const minutes = Math.ceil(hours * 60 + 2); // 2 min buffer
  return minutes;
}
