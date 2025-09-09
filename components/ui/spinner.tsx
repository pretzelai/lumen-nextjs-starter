import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Spinner({ className, size = "md" }: SpinnerProps) {
  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-6 h-6",
  };

  return (
    <div
      className={cn(
        "border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin",
        sizeClasses[size],
        className
      )}
    />
  );
}
