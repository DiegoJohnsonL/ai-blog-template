# AI Blog Template — Ideas & Direction

## What we built

A Next.js 16 landing page with an AI content agent that lives in the cloud. You talk to it via Telegram and it writes blog posts and manages translations by committing directly to the repo via the GitHub API. Vercel auto-deploys on push.

### Stack

- **Next.js 16** (App Router, Turbopack)
- **next-intl** — i18n with locale routing (`/en/blog`, `/es/blog`)
- **MDX** — blog posts as `.mdx` files with custom remark components
- **AI SDK v6** — `ToolLoopAgent` + `streamText` with AI Gateway
- **Chat SDK** — Telegram adapter, multi-platform webhook handler
- **Drizzle ORM** — PostgreSQL for users, whitelist, and chat state
- **shadcn/ui** — component library
- **GitHub API** (Octokit) — agent writes content via commits

### Sandboxing

The agent can only touch files matching these patterns:

- `content/blog/{locale}/{slug}.mdx`
- `messages/{locale}.json`
- `public/images/blog/*`

Tools are the sandbox — the agent has no filesystem access, only scoped GitHub API calls.

---

## Distribution ideas

### Option A: GitHub template repo

People click "Use this template" on GitHub, clone it, edit `agent.config.ts` (or equivalent), deploy. Lowest friction, zero infrastructure on our side.

**Pros**: simple, familiar, no maintenance burden
**Cons**: no update path once forked, fragmentation over time

### Option B: npm package / shadcn-style registry

Ship the agent as an installable package or shadcn component that people add to existing Next.js projects:

```bash
pnpx shadcn add ai-blog-agent
# or
pnpm add @ai-blog/agent
```

This would scaffold the webhook route, tools, bot config, and content directories into their project.

**Pros**: composable, works with existing projects, updatable
**Cons**: harder to maintain, needs to handle different project structures

### Option C: SaaS with dashboard

Hosted service where users connect their GitHub repo and configure the agent via a web UI. No code needed.

**Pros**: widest audience, recurring revenue potential
**Cons**: significant infra, auth, billing — a full product

### Recommendation

Start with **Option A** (template repo) to validate demand. Move to **Option B** (package/registry) once patterns stabilize. **Option C** is a product pivot, not a template evolution — pursue only if there's clear demand.

---

## Configuration layer

Regardless of distribution, the agent's behavior should be driven by a single config:

```typescript
// agent.config.ts
export default defineAgentConfig({
  name: "my-blog-agent",
  model: "anthropic/claude-sonnet-4.5",
  locales: ["en", "es", "pt"],
  defaultLocale: "en",
  contentPaths: {
    blog: "content/blog/{locale}/{slug}.mdx",
    translations: "messages/{locale}.json",
    images: "public/images/blog/*",
  },
  frontmatter: {
    title: { type: "string", required: true },
    description: { type: "string", required: true },
    date: { type: "date", default: "now" },
    tags: { type: "string[]" },
  },
  instructions: "You write concise, technical blog posts.",
  platforms: ["telegram"],
});
```

The web UI (if built) reads and writes this same config — it's a layer on top, not a replacement.

---

## Web admin interface (future)

A protected `/admin` route that lets non-technical team members:

- Edit the agent's system prompt / personality
- Add/remove locales
- Define blog frontmatter schema
- Manage the user whitelist
- View agent activity log (what it committed, when)

This reads from the database (same Postgres) and overrides the file-based config at runtime.

---

## Open questions

1. **Update path**: If we go with a template, how do users pull upstream improvements? Git merge from template? A CLI that patches?
2. **Custom tools**: Should users be able to add their own agent tools (e.g. "resize image", "generate OG image") without forking?
3. **Multi-repo**: Could one agent manage content across multiple repos/projects?
4. **Approval flow**: Should the agent open PRs instead of pushing directly? Configurable per-operation?
5. **Content preview**: Can we show a preview link in the Telegram chat before the agent commits?
