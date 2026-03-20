import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {};

const withNextIntl = createNextIntlPlugin();

export default withWorkflow(withNextIntl(nextConfig));
