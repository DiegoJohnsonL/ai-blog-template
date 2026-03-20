import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getAllBlogPosts } from "@/lib/blog";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function BlogPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  const posts = await getAllBlogPosts(locale);

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("title")}
        </h1>

        {posts.length === 0 ? (
          <p className="mt-8 text-muted-foreground">{t("noPostsYet")}</p>
        ) : (
          <ul className="mt-8 space-y-8">
            {posts.map((post) => (
              <li key={post.slug}>
                <article className="group">
                  <Link href={`/blog/${post.slug}`}>
                    <h2 className="text-xl font-semibold group-hover:text-muted-foreground">
                      {post.title}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t("publishedOn", { date: post.date })}
                    </p>
                    <p className="mt-2 text-muted-foreground">
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
