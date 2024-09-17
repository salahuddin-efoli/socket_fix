//const { mountRoutes } = require('remix-mount-routes');
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
console.log(mountRoutes);
const basePath = "/root/sate/salahuddin/socket"
/** @type {import('@remix-run/dev').AppConfig} */
export default {
  ignoredRouteFiles: ['.*'],
  appDirectory: "app",
  serverModuleFormat: "cjs",
  dev: { port: process.env.HMR_SERVER_PORT || 8002 },
  future: {},
  browserNodeBuiltinsPolyfill: { modules: { fs: true, path: true, events: true } },
  serverAdapter: "@remix-run/express",
  serverBuildPath: "build/server/index.js",
  publicPath: `${basePath}/build/`,
  //assetsBuildDirectory: `public${basePath}/build`,
 // routes: defineRoutes => {
   // return mountRoutes(basePath, 'routes')
 // },
};
