import { cn } from "@/lib/utils";

export function KeywordChip({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full bg-secondary font-medium text-secondary-foreground",
        small ? "px-2.5 py-0.5 text-xs" : "px-3.5 py-1.5 text-sm",
      )}
    >
      {children}
    </span>
  );
}
