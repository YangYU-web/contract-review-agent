// Service Worker for 企业合同智能审查Agent
// 缓存名称使用版本号
const CACHE_NAME = 'contract-review-v1';

// 核心静态资源
const CACHE_URLS = [
  '/',
  '/offline',
  '/manifest.json',
];

// install 事件：缓存核心静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] 缓存核心静态资源');
        return cache.addAll(CACHE_URLS);
      })
      .then(() => {
        // 跳过等待，立即激活
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] install 缓存失败:', error);
      })
  );
});

// activate 事件：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] 清理旧缓存:', cacheName);
              return caches.delete(cacheName);
            }
            return null;
          })
        );
      })
      .then(() => {
        // 立即接管所有客户端
        return self.clients.claim();
      })
  );
});

// fetch 事件：网络优先策略，失败时回退到缓存
self.addEventListener('fetch', (event) => {
  // 仅处理 GET 请求
  if (event.request.method !== 'GET') return;

  // 忽略非 http(s) 请求（如 chrome-extension 等）
  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 网络请求成功，缓存响应副本（仅对有效响应）
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            })
            .catch(() => {
              // 缓存写入失败忽略
            });
        }
        return response;
      })
      .catch(() => {
        // 网络失败，回退到缓存
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // 如果导航请求失败且无缓存，返回离线页面
            if (event.request.mode === 'navigate') {
              return caches.match('/offline');
            }
            return new Response('离线状态，资源不可用', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
          });
      })
  );
});
