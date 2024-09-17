import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Related: https://github.com/remix-run/remix/issues/2835#issuecomment-1144102176
// Replace the HOST env var with SHOPIFY_APP_URL so that it doesn't break the remix server. The CLI will eventually
// stop passing in HOST, so we can remove this workaround after the next major release.
if (
    process.env.HOST &&
    (!process.env.SHOPIFY_APP_URL ||
        process.env.SHOPIFY_APP_URL === process.env.HOST)
) {
    process.env.SHOPIFY_APP_URL = process.env.HOST;
    delete process.env.HOST;
}

const host = new URL(process.env.SHOPIFY_APP_URL || "http://localhost")
    .hostname;
let hmrConfig;

if (host === "localhost") {
    hmrConfig = {
        protocol: "ws",
        host: "localhost",
        port: 64999,
        clientPort: 64999,
    };
} else {
    hmrConfig = {
        protocol: "wss",
        host: host,
        port: parseInt(process.env.FRONTEND_PORT) || 8002,
        clientPort: 443,
    };
}

export default defineConfig({
    server: {
        port: Number(process.env.PORT || 3000),
        hmr: hmrConfig,
        fs: {
            // See https://vitejs.dev/config/server-options.html#server-fs-allow for more information
            allow: ["app", "node_modules", "log"],
        },
    },
    plugins: [
        remix({
            ignoredRouteFiles: ["**/.*"],
            routes(defineRoutes) {
                return defineRoutes((route) => {
                    route("/supports/signin", "routes/supports/signin.jsx");
                    route("/supports", "routes/supports/home.jsx", () => {
                        route("", "routes/supports/dashboard.jsx", { index: true });
                        route("banners", "routes/supports/banners/banner.jsx", () => {
                            route("", "routes/supports/banners/_index.jsx", { index: true });
                            route("new", "routes/supports/banners/new.jsx");
                            route(":id", "routes/supports/banners/edit.jsx");
                        });
                        route("articles", "routes/supports/articles/article.jsx", () => {
                            route("", "routes/supports/articles/_index.jsx", { index: true });
                            route("new", "routes/supports/articles/new.jsx");
                            route(":id", "routes/supports/articles/edit.jsx");
                        });
                        route("videos", "routes/supports/videos/video.jsx", () => {
                            route("", "routes/supports/videos/_index.jsx", { index: true });
                            route("new", "routes/supports/videos/new.jsx");
                            route(":id", "routes/supports/videos/edit.jsx");
                        });
                        route("recommended-apps", "routes/supports/recommended-apps/recommended-app.jsx", () => {
                            route("", "routes/supports/recommended-apps/_index.jsx", { index: true });
                            route("new", "routes/supports/recommended-apps/new.jsx");
                            route(":id", "routes/supports/recommended-apps/edit.jsx");
                        });
                        route("faqs", "routes/supports/faqs/faq.jsx", () => {
                            route("", "routes/supports/faqs/_index.jsx", { index: true });
                            route("new", "routes/supports/faqs/new.jsx");
                            route(":id", "routes/supports/faqs/edit.jsx");
                        });
                        route("feature-requests", "routes/supports/feature-requests/feature-request.jsx", () => {
                            route("", "routes/supports/feature-requests/_index.jsx", { index: true });
                            route("new", "routes/supports/feature-requests/new.jsx");
                            route(":id", "routes/supports/feature-requests/edit.jsx");
                        });
                        route("tickets", "routes/supports/tickets/ticket.jsx", () => {
                            route("", "routes/supports/tickets/_index.jsx", { index: true });
                            route(":id", "routes/supports/tickets/reply-edit.jsx");
                        });
                        route("agents", "routes/supports/agents/agent.jsx", () => {
                            route("", "routes/supports/agents/_index.jsx", { index: true });
                            route("new", "routes/supports/agents/new.jsx");
                            route(":id", "routes/supports/agents/edit.jsx");
                        });
                        route("permissions", "routes/supports/permissions/permission.jsx", () => {
                            route("", "routes/supports/permissions/_index.jsx", { index: true });
                            route("new", "routes/supports/permissions/new.jsx");
                            route(":id", "routes/supports/permissions/edit.jsx");
                        });
                    });
                });
            },
        }),
        tsconfigPaths(),
    ],
    build: {
        assetsInlineLimit: 0,
        rollupOptions: {
            external: ['fs']
        }
    },
});
