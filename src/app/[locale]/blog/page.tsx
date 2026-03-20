import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getAllBlogPosts } from "@/lib/blog";

export default async function BlogPage() {
  const locale = useLocale();
  const t = useTranslations("blog");
  const posts = await getAllBlogPosts(locale);

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {t("title")}
        </h1>

        {posts.length === 0 ? (
          <p className="mt-8 text-zinc-500 dark:text-zinc-400">
            {t("noPostsYet")}
          </p>
        ) : (
          <ul className="mt-8 space-y-8">
            {posts.map((post) => (
              <li key={post.slug}>
                <article className="group">
                  <Link href={`/blog/${post.slug}`}>
                    <h2 className="text-xl font-semibold text-zinc-900 group-hover:text-zinc-600 dark:text-zinc-50 dark:group-hover:text-zinc-300">
                      {post.title}
                    </h2>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {t("publishedOn", { date: post.date })}
                    </p>
                    <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                      {post.description}
                    </p>
                  </Link>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
