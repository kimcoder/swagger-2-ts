import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 여러 클래스 이름을 병합합니다.
 * @param inputs 클래스 이름 목록
 * @returns 병합된 클래스 이름
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
