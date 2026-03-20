import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function Home() {
  const t = useTranslations();

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          {t("home.title")}
        </h1>
        <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          {t("home.description")}
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Link
            href="/blog"
            className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {t("nav.blog")}
          </Link>
        </div>
      </div>
    </main>
  );
}
