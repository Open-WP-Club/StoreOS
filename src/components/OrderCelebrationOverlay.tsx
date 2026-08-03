import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { ShoppingCart, X } from 'lucide-react';
import useNotifications from '../stores/notificationStore';

const AUTO_DISMISS_MS = 6000;

export default function OrderCelebrationOverlay(): React.ReactElement | null {
  const pendingCelebration = useNotifications((s) => s.pendingCelebration);
  const clearCelebration = useNotifications((s) => s.clearCelebration);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pendingCelebration) return;

    // Fire confetti from both sides
    const fire = (particleRatio: number, opts: confetti.Options): void => {
      confetti({
        ...opts,
        origin: { y: 0.7 },
        particleCount: Math.floor(200 * particleRatio),
      });
    };

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });

    // Auto-dismiss
    timerRef.current = setTimeout(() => {
      clearCelebration();
    }, AUTO_DISMISS_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pendingCelebration, clearCelebration]);

  if (!pendingCelebration) return null;

  const { orderCount, orderId, orderTotal, customerName } = pendingCelebration;
  const isMultiple = orderCount > 1;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
      aria-live="assertive"
    >
      <div
        className="pointer-events-auto relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 px-8 py-6 mx-4 max-w-sm w-full text-center animate-bounce-in"
        style={{ animation: 'celebrationIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}
      >
        <button
          onClick={clearCelebration}
          className="absolute top-3 right-3 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/40 mx-auto mb-4">
          <ShoppingCart className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
          {isMultiple ? `${orderCount} New Orders!` : 'New Order!'}
        </h2>

        {/* Details */}
        {!isMultiple && (
          <div className="space-y-1 mb-3">
            {orderId && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Order #{orderId}</p>
            )}
            {customerName && (
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{customerName}</p>
            )}
          </div>
        )}

        {orderTotal && (
          <p className="text-3xl font-extrabold text-green-600 dark:text-green-400 mt-2">
            {orderTotal}
          </p>
        )}

        {/* Progress bar for auto-dismiss */}
        <div className="mt-4 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full"
            style={{ animation: `shrink ${AUTO_DISMISS_MS}ms linear forwards` }}
          />
        </div>
      </div>

      <style>{`
        @keyframes celebrationIn {
          from { opacity: 0; transform: scale(0.5) translateY(20px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}
