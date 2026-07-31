import type { NextConfig } from "next";
import path from "node:path";

const isGitHubPagesBuild = process.env.GITHUB_PAGES === "true";
const pagesBasePath = (process.env.PAGES_BASE_PATH ?? "").replace(/\/$/, "");
const pagesGameRouteShim = path.resolve(
  process.cwd(),
  "build-support/github-pages/game-route.ts",
);
const pagesHomeShim = path.resolve(
  process.cwd(),
  "build-support/github-pages/home-page.tsx",
);
const pagesLayoutShim = path.resolve(
  process.cwd(),
  "build-support/github-pages/root-layout.tsx",
);

const nextConfig: NextConfig = {
  ...(isGitHubPagesBuild
    ? {
        output: "export",
        trailingSlash: true,
        basePath: pagesBasePath,
        assetPrefix: pagesBasePath,
        images: {
          unoptimized: true,
        },
        typescript: {
          tsconfigPath: "build-support/github-pages/tsconfig.json",
        },
        webpack(config, { webpack }) {
          config.plugins.push(
            new webpack.NormalModuleReplacementPlugin(
              /[/\\]app[/\\]api[/\\]game[/\\]route\.ts$/,
              pagesGameRouteShim,
            ),
            new webpack.NormalModuleReplacementPlugin(
              /[/\\]app[/\\]page\.tsx$/,
              pagesHomeShim,
            ),
            new webpack.NormalModuleReplacementPlugin(
              /[/\\]app[/\\]layout\.tsx$/,
              pagesLayoutShim,
            ),
          );

          return config;
        },
      }
    : {}),
};

export default nextConfig;
