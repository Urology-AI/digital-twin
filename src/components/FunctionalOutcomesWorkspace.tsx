import { FunctionalOutcomesPanel } from "@/components/FunctionalOutcomesPanel";
import { cn } from "@/lib/utils";

export function FunctionalOutcomesWorkspace({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5 pb-10 sm:gap-5 sm:px-5 sm:py-6",
        className,
      )}
    >
      <FunctionalOutcomesPanel />
    </div>
  );
}
