import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";

const CONTENT_DIR = path.join(process.cwd(), "content/blog");

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  locale: string;
  tags: string[];
  content: string;
}

export async function getBlogPost(
  locale: string,
  slug: string,
): Promise<BlogPost | null> {
  const filePath = path.join(CONTENT_DIR, locale, `${slug}.mdx`);

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const { data, content } = matter(raw);

    return {
      slug,
      title: data.title,
      description: data.description,
      date: data.date,
      locale,
      tags: data.tags ?? [],
      content,
    };
  } catch {
    return null;
  }
}

export async function getAllBlogPosts(locale: string): Promise<BlogPost[]> {
  const dir = path.join(CONTENT_DIR, locale);

  try {
    const files = await fs.readdir(dir);
    const posts = await Promise.all(
      files
        .filter((f) => f.endsWith(".mdx"))
        .map((f) => getBlogPost(locale, f.replace(/\.mdx$/, ""))),
    );

    return posts
      .filter((p): p is BlogPost => p !== null)
      .sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
  } catch {
    return [];
  }
}
