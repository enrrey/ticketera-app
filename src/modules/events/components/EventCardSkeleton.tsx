import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholder matching EventCard's layout. Purely visual, no
 * conditional logic, so it does not have a dedicated test (see spec).
 */
export function EventCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 overflow-hidden rounded-2xl ring-1 ring-foreground/10">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="flex flex-col gap-2 px-4 pb-4">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );
}
