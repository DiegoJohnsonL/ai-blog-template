import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Blog Template",
  description: "A blog powered by an AI content agent",
};

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          <header className="border-b border-border">
            <nav className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
              <Link href="/" className="text-sm font-semibold">
                AI Blog
              </Link>
              <div className="flex items-center gap-4">
                <Link
                  href="/blog"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Blog
                </Link>
                <LocaleSwitcher locale={locale} />
              </div>
            </nav>
          </header>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

function LocaleSwitcher({ locale }: { locale: string }) {
  return (
    <div className="flex gap-2 text-xs">
      {routing.locales.map((l) => (
        <Link
          key={l}
          href="/"
          locale={l}
          className={`uppercase ${l === locale ? "font-bold text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {l}
        </Link>
      ))}
    </div>
  );
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
