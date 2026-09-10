"use client";

import { useEffect, useState } from "react";

/** True after the first client render — use to defer localStorage reads and avoid hydration mismatches. */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
