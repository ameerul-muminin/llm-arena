"use client";

import { RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/**
 * The retry offered next to an unavailable catalogue.
 *
 * `router.refresh()` rather than `location.reload()`: the list is read by a
 * server component, so re-running that render is precisely the work that needs
 * doing, and it keeps whatever the person had already typed into the composer.
 *
 * One component for both callers — the picker and `/models` — so a retry does
 * the same thing and is worded the same way wherever it appears.
 */

export const CatalogueRetry = ({ className }: { readonly className?: string }) => {
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size="xs"
      className={className}
      onClick={() => {
        router.refresh();
      }}
    >
      <RotateCw aria-hidden="true" />
      Try again
    </Button>
  );
};
