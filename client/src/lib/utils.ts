import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Tailwind Class Merger ---
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Native Time-Ago Formatter (Replaces date-fns) ---
export function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);

  if (Number.isNaN(seconds)) return 'Unknown time';

  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// --- US Phone Formatter ---
export const formatUSPhone = (value: string) => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, '');
  const len = phoneNumber.length;
  if (len < 2) return `+1 `;
  if (len < 5) return `+1 (${phoneNumber.slice(1, 4)}`;
  if (len < 8) return `+1 (${phoneNumber.slice(1, 4)}) ${phoneNumber.slice(4, 7)}`;
  return `+1 (${phoneNumber.slice(1, 4)}) ${phoneNumber.slice(4, 7)}-${phoneNumber.slice(7, 11)}`;
};