import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBDT(amount: number | undefined | null): string {
  const num = Number(amount) || 0;
  return `৳${num.toLocaleString('en-IN')}`;
}

export const MONTHS_LIST = [
  { num: 1, en: 'January', bn: 'জানুয়ারি' },
  { num: 2, en: 'February', bn: 'ফেব্রুয়ারি' },
  { num: 3, en: 'March', bn: 'মার্চ' },
  { num: 4, en: 'April', bn: 'এপ্রিল' },
  { num: 5, en: 'May', bn: 'মে' },
  { num: 6, en: 'June', bn: 'জুন' },
  { num: 7, en: 'July', bn: 'জুলাই' },
  { num: 8, en: 'August', bn: 'আগস্ট' },
  { num: 9, en: 'September', bn: 'সেপ্টেম্বর' },
  { num: 10, en: 'October', bn: 'অক্টোবর' },
  { num: 11, en: 'November', bn: 'নভেম্বর' },
  { num: 12, en: 'December', bn: 'ডিসেম্বর' },
];

export const YEARS_LIST = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

/**
 * Compresses and resizes an uploaded image file on an HTML5 canvas so that
 * high-resolution smartphone camera photos upload instantaneously and reliably
 * to PostgreSQL as compact base64 data URLs.
 */
export function compressImageFile(
  file: File,
  maxDimension: number = 600,
  quality: number = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ছবি রিড করতে সমস্যা হয়েছে'));
    reader.onload = () => {
      const rawDataUrl = String(reader.result || '');
      if (!rawDataUrl.startsWith('data:image/')) {
        reject(new Error('অনুগ্রহ করে একটি বৈধ ছবি (JPG, PNG, WEBP) নির্বাচন করুন'));
        return;
      }
      const img = new Image();
      img.onerror = () => {
        // Fallback to raw data URL if browser cannot decode into canvas
        resolve(rawDataUrl);
      };
      img.onload = () => {
        try {
          let width = img.width || maxDimension;
          let height = img.height || maxDimension;
          if (width > maxDimension || height > maxDimension) {
            if (width >= height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }
          // Fill white background for transparent PNGs converted to JPEG
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed || rawDataUrl);
        } catch {
          resolve(rawDataUrl);
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

