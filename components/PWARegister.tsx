'use client';

import { useEffect, useState } from 'react';

export default function PWARegister() {
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // 监听应用安装状态
    const handleBeforeInstallPrompt = () => {
      setInstalled(false);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
    };

    // 注册 Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);

      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // 注册成功
          console.log('Service Worker 注册成功:', registration.scope);

          // 监听更新提示（如果有新版本）
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // 新版本已安装但等待激活，通知用户刷新
                console.log('检测到新版本，刷新页面以更新。');
              }
            });
          });
        })
        .catch((error) => {
          // 注册失败
          console.error('Service Worker 注册失败:', error);
        });
    }

    return () => {
      if ('serviceWorker' in navigator) {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      }
    };
  }, []);

  // 不渲染可见 UI
  return null;
}
