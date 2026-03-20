import type { ReactNode } from "react";
import { Geist } from "next/font/google";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});


// Root layout — delegates html/body to [locale]/layout.tsx
// so the lang attribute can be set per locale.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
