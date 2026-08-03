import React, { useState, useEffect, useRef, ReactElement } from 'react';
import { X, ExternalLink, RefreshCw, ArrowLeft, Loader2 } from 'lucide-react';

// Declare the Electron webview element type for TypeScript
declare global {
  interface HTMLWebViewElement extends HTMLElement {
    src: string;
    reload: () => void;
    goBack: () => void;
    goForward: () => void;
    canGoBack: () => boolean;
    canGoForward: () => boolean;
  }
}

interface WpAdminModalProps {
  isOpen: boolean;
  url: string;
  title?: string;
  onClose: () => void;
}

export default function WpAdminModal({
  isOpen,
  url,
  title = 'WP Admin',
  onClose,
}: WpAdminModalProps): ReactElement | null {
  const [isLoading, setIsLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState(url);
  const webviewRef = useRef<HTMLWebViewElement | null>(null);

  // Sync URL when modal opens with a new URL (render-time adjustment - only
  // reacts to isOpen/url changing, not to currentUrl changing from in-webview
  // navigation). See https://react.dev/learn/you-might-not-need-an-effect
  const [prevSyncKey, setPrevSyncKey] = useState({ isOpen, url });
  if (prevSyncKey.isOpen !== isOpen || prevSyncKey.url !== url) {
    setPrevSyncKey({ isOpen, url });
    if (isOpen && url !== currentUrl) {
      setCurrentUrl(url);
      setIsLoading(true);
    }
  }

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleLoadStart = (): void => {
      setIsLoading(true);
    };

    const handleLoadStop = (): void => {
      setIsLoading(false);
    };

    const handleDidNavigate = (event: Event): void => {
      const e = event as CustomEvent & { url: string };
      if (e.url) {
        setCurrentUrl(e.url);
      }
    };

    webview.addEventListener('did-start-loading', handleLoadStart);
    webview.addEventListener('did-stop-loading', handleLoadStop);
    webview.addEventListener('did-navigate', handleDidNavigate);
    webview.addEventListener('did-navigate-in-page', handleDidNavigate);

    return () => {
      webview.removeEventListener('did-start-loading', handleLoadStart);
      webview.removeEventListener('did-stop-loading', handleLoadStop);
      webview.removeEventListener('did-navigate', handleDidNavigate);
      webview.removeEventListener('did-navigate-in-page', handleDidNavigate);
    };
  }, []);

  const handleRefresh = (): void => {
    const webview = webviewRef.current as (HTMLWebViewElement & { reload: () => void }) | null;
    if (webview?.reload) {
      webview.reload();
    }
  };

  const handleGoBack = (): void => {
    const webview = webviewRef.current as (HTMLWebViewElement & { goBack: () => void }) | null;
    if (webview?.goBack) {
      webview.goBack();
    }
  };

  const handleOpenExternal = (): void => {
    window.open(currentUrl, '_blank');
  };

  const handleBackdropKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape' || e.key === 'Enter') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        role="button"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={handleBackdropKeyDown}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div className="relative w-[90vw] h-[85vh] max-w-6xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <button
              onClick={handleGoBack}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Назад"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleRefresh}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Презареди"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {title}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-md">
                {currentUrl}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenExternal}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Отвори в браузър"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
              title="Затвори"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute top-14 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse w-full" />
          </div>
        )}

        {/* WebView Container */}
        <div className="flex-1 relative bg-white">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Зареждане на WP Admin...
                </span>
              </div>
            </div>
          )}

          {/*
            Note: webview is an Electron-specific element.
            In browser context, we fall back to an iframe.
            For full webview functionality, this needs to run in Electron.
          */}
          {typeof window !== 'undefined' && 'process' in window ? (
            // Electron environment - use webview
            /* eslint-disable react/no-unknown-property */
            <webview
              ref={webviewRef}
              src={url}
              className="w-full h-full"
              // @ts-expect-error - Electron webview attributes
              allowpopups="true"
              // @ts-expect-error - Electron webview attributes
              nodeintegration="false"
            />
          ) /* eslint-enable react/no-unknown-property */ : (
            // Browser environment - use iframe (limited functionality)
            <iframe
              src={url}
              className="w-full h-full border-0"
              title={title}
              onLoad={() => setIsLoading(false)}
            />
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Използвайте плъгин функциите директно в WP Admin. Промените ще се синхронизират автоматично.
          </p>
        </div>
      </div>
    </div>
  );
}
