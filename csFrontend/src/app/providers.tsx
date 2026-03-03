"use client";

import { HospitalProvider } from "@/shared/store/HospitalStore";

export function Providers({ children }: { children: React.ReactNode }) {
  return <HospitalProvider>{children}</HospitalProvider>;
}
