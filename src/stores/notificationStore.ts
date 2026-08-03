import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { prependAndTrim, nowMs } from './storeUtils';

// ============================================
// Types
// ============================================

export type NotificationType = 'new_order' | 'low_stock' | 'failed_payment' | 'order_status' | 'info';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  route?: string;
  read: boolean;
  timestamp: number;
  storeId?: string;
  meta?: Record<string, unknown>;
}

export interface OrderCelebrationData {
  orderCount: number;
  orderId?: number;
  orderTotal?: string;
  customerName?: string;
}

interface NotificationState {
  notifications: AppNotification[];
  soundEnabled: boolean;
  confettiEnabled: boolean;
  maxNotifications: number;
  pendingCelebration: OrderCelebrationData | null;
}

interface NotificationActions {
  addNotification: (notification: Omit<AppNotification, 'id' | 'read' | 'timestamp'>) => AppNotification;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  setConfettiEnabled: (enabled: boolean) => void;
  triggerCelebration: (data: OrderCelebrationData) => void;
  clearCelebration: () => void;
  getUnreadCount: () => number;
}

export type NotificationStore = NotificationState & NotificationActions;

// ============================================
// Store
// ============================================

const useNotifications = create<NotificationStore>()(
  persist(
    (set, get) => ({
      notifications: [],
      soundEnabled: true,
      confettiEnabled: true,
      maxNotifications: 100,
      pendingCelebration: null,

      addNotification: (notification) => {
        const newNotification: AppNotification = {
          ...notification,
          id: crypto.randomUUID(),
          read: false,
          timestamp: nowMs(),
        };

        set((state) => ({
          notifications: prependAndTrim(state.notifications, newNotification, state.maxNotifications),
        }));

        return newNotification;
      },

      markAsRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        }));
      },

      removeNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      },

      clearAll: () => {
        set({ notifications: [] });
      },

      setSoundEnabled: (enabled) => {
        set({ soundEnabled: enabled });
      },

      setConfettiEnabled: (enabled) => {
        set({ confettiEnabled: enabled });
      },

      triggerCelebration: (data) => {
        set({ pendingCelebration: data });
      },

      clearCelebration: () => {
        set({ pendingCelebration: null });
      },

      getUnreadCount: () => {
        return get().notifications.filter((n) => !n.read).length;
      },
    }),
    {
      name: 'woocommerce-notifications',
      partialize: (state): Pick<NotificationState, 'notifications' | 'soundEnabled' | 'confettiEnabled'> => ({
        notifications: state.notifications,
        soundEnabled: state.soundEnabled,
        confettiEnabled: state.confettiEnabled,
      }),
    }
  )
);

export default useNotifications;
