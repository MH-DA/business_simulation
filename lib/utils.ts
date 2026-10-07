import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn/ui 컴포넌트가 쓰는 클래스 병합 유틸
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
