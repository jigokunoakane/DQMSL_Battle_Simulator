import { registerRoute } from "workbox-routing";
import { NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";
import { precacheAndRoute } from "workbox-precaching";

// Workbox のバージョンを指定 (必要に応じて変更)
// workbox-window を使用しない場合は、`importScripts` の代わりに `import` を使用します。
// Workbox v6.x 以降では `importScripts` は非推奨です。
// https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js

// precacheAndRoute を使用して、ビルド時に生成されるアセットをキャッシュします。
// `precacheAndRoute(self.__WB_MANIFEST)` は、workbox-webpack-plugin によって生成されるマニフェストを元に、
// アプリケーションのシェル（HTML、CSS、JSなど）をキャッシュします。
precacheAndRoute(self.__WB_MANIFEST);

// JavaScript, HTML, CSS ファイルを "network first" でキャッシュ
registerRoute(
  ({ request }) => request.destination === "script" || request.destination === "document" || request.destination === "style",
  new NetworkFirst({
    cacheName: "asset-cache",
  })
);

// その他のファイル（画像など）を "stale-while-revalidate" でキャッシュ
registerRoute(
  ({ request }) => request.destination !== "script" && request.destination !== "document" && request.destination !== "style",
  new StaleWhileRevalidate({
    cacheName: "static-asset-cache",
  })
);
