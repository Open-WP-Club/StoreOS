import { useState, ReactElement } from 'react';
import { ChevronDown, ChevronRight, Package, Truck, MapPin, Phone, User, CreditCard, Clock, ExternalLink } from 'lucide-react';
import { WooCommerceMetaData, OrderShippingLine } from '../types';

// ============================================
// Plugin Recognition Patterns
// ============================================

interface PluginInfo {
  name: string;
  icon: ReactElement;
  color: string;
  keyPatterns: RegExp[];
}

const KNOWN_PLUGINS: Record<string, PluginInfo> = {
  econt: {
    name: 'Еконт',
    icon: <Truck className="w-4 h-4" />,
    color: 'bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800',
    keyPatterns: [/econt/i, /woo_bg_econt/i],
  },
  speedy: {
    name: 'Speedy',
    icon: <Truck className="w-4 h-4" />,
    color: 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    keyPatterns: [/speedy/i, /woo_bg_speedy/i],
  },
  cvc: {
    name: 'CVC',
    icon: <Truck className="w-4 h-4" />,
    color: 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    keyPatterns: [/cvc/i],
  },
  priority: {
    name: 'Priority Processing',
    icon: <Clock className="w-4 h-4" />,
    color: 'bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800',
    keyPatterns: [/wpp_priority/i, /priority_processing/i, /express/i],
  },
};

// Fields to display prominently from shipping data
const IMPORTANT_SHIPPING_FIELDS = [
  { key: 'receiver', label: 'Получател', icon: User },
  { key: 'receiverClient.name', label: 'Получател', icon: User },
  { key: 'phone', label: 'Телефон', icon: Phone },
  { key: 'receiverClient.phones', label: 'Телефон', icon: Phone },
  { key: 'city', label: 'Град', icon: MapPin },
  { key: 'type', label: 'Тип доставка', icon: Package },
  { key: 'selectedOffice', label: 'Офис код', icon: MapPin },
  { key: 'receiverOfficeCode', label: 'Офис код', icon: MapPin },
  { key: 'payment', label: 'Плащане', icon: CreditCard },
  { key: 'services.cdAmount', label: 'Наложен платеж', icon: CreditCard },
];

// Internal/hidden keys
const HIDDEN_META_PREFIXES = ['_'];
const HIDDEN_META_KEYS = ['is_vat_exempt', '_billing_address_index', '_shipping_address_index'];

// ============================================
// Helper Functions
// ============================================

function getNestedValue(obj: unknown, path: string): unknown {
  const keys = path.split('.');
  let value: unknown = obj;
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = (value as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return value;
}

function detectPlugin(key: string): PluginInfo | null {
  for (const plugin of Object.values(KNOWN_PLUGINS)) {
    if (plugin.keyPatterns.some(pattern => pattern.test(key))) {
      return plugin;
    }
  }
  return null;
}

function isJsonString(str: unknown): boolean {
  if (typeof str !== 'string') return false;
  try {
    const parsed = JSON.parse(str);
    return typeof parsed === 'object' && parsed !== null;
  } catch {
    return false;
  }
}

function parseJsonSafely(value: unknown): unknown {
  if (typeof value === 'string' && isJsonString(value)) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function formatMetaKey(key: string): string {
  return key
    .replace(/^(woo_bg_|wpp_|_)/gi, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Да' : 'Не';
  if (Array.isArray(value)) return value.join(', ');
  if (value === 'yes') return 'Да';
  if (value === 'no') return 'Не';
  if (value === 'cod') return 'Наложен платеж';
  if (value === 'office') return 'До офис';
  if (value === 'address') return 'До адрес';
  return String(value);
}

function isVisibleMeta(meta: WooCommerceMetaData): boolean {
  const key = String(meta.key);
  if (HIDDEN_META_PREFIXES.some(prefix => key.startsWith(prefix))) return false;
  if (HIDDEN_META_KEYS.includes(key)) return false;
  if (meta.value === '' || meta.value === null || meta.value === undefined) return false;
  return true;
}

// ============================================
// Sub-Components
// ============================================

interface CollapsibleJsonProps {
  data: unknown;
  title?: string;
  defaultOpen?: boolean;
}

function CollapsibleJson({ data, title, defaultOpen = false }: CollapsibleJsonProps): ReactElement {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (typeof data !== 'object' || data === null) {
    return <span className="text-gray-900 dark:text-white">{formatValue(data)}</span>;
  }

  const entries = Object.entries(data as Record<string, unknown>);

  return (
    <div className="w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
      >
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {title || `${entries.length} полета`}
      </button>
      {isOpen && (
        <div className="mt-2 pl-4 border-l-2 border-gray-200 dark:border-gray-600 space-y-1">
          {entries.map(([key, value]) => (
            <div key={key} className="text-sm">
              <span className="text-gray-500 dark:text-gray-400">{formatMetaKey(key)}: </span>
              {typeof value === 'object' && value !== null ? (
                <CollapsibleJson data={value} />
              ) : (
                <span className="text-gray-900 dark:text-white">{formatValue(value)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ShippingCardProps {
  data: Record<string, unknown>;
  plugin: PluginInfo | null;
  title: string;
}

function ShippingCard({ data, plugin, title }: ShippingCardProps): ReactElement {
  const [showRaw, setShowRaw] = useState(false);

  // Extract important fields
  const importantData: Array<{ label: string; value: string; Icon: typeof User }> = [];

  for (const field of IMPORTANT_SHIPPING_FIELDS) {
    const value = getNestedValue(data, field.key);
    if (value !== undefined && value !== null && value !== '') {
      importantData.push({
        label: field.label,
        value: formatValue(value),
        Icon: field.icon,
      });
    }
  }

  // Remove duplicates by label
  const uniqueData = importantData.filter(
    (item, index, self) => index === self.findIndex(t => t.label === item.label)
  );

  return (
    <div className={`rounded-lg border p-4 ${plugin?.color || 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {plugin?.icon || <Package className="w-4 h-4" />}
          <h4 className="font-medium text-gray-900 dark:text-white">
            {plugin?.name || title}
          </h4>
        </div>
        <button
          onClick={() => setShowRaw(!showRaw)}
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {showRaw ? 'Скрий детайли' : 'Покажи всички'}
        </button>
      </div>

      {/* Important fields grid */}
      {uniqueData.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          {uniqueData.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              <item.Icon className="w-3 h-3 text-gray-400" />
              <span className="text-gray-500 dark:text-gray-400">{item.label}:</span>
              <span className="text-gray-900 dark:text-white font-medium truncate">{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Raw data */}
      {showRaw && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
          <CollapsibleJson data={data} title="Всички данни" defaultOpen={true} />
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

interface PluginMetaPanelProps {
  orderMeta: WooCommerceMetaData[];
  shippingLines: OrderShippingLine[];
  orderId?: number;
  storeUrl?: string;
  onOpenWpAdmin?: (url: string) => void;
}

export default function PluginMetaPanel({
  orderMeta,
  shippingLines,
  orderId,
  storeUrl,
  onOpenWpAdmin,
}: PluginMetaPanelProps): ReactElement | null {
  // Filter and group meta data by plugin
  const visibleMeta = orderMeta.filter(isVisibleMeta);

  // Group by detected plugin
  const groupedMeta: Record<string, Array<{ key: string; value: unknown; plugin: PluginInfo | null }>> = {};

  for (const meta of visibleMeta) {
    const key = String(meta.key);
    const plugin = detectPlugin(key);
    const groupKey = plugin?.name || 'Други';

    if (!groupedMeta[groupKey]) {
      groupedMeta[groupKey] = [];
    }

    // Parse JSON values
    const parsedValue = parseJsonSafely(meta.value);

    groupedMeta[groupKey].push({
      key,
      value: parsedValue,
      plugin,
    });
  }

  // Also process shipping lines meta
  const shippingMeta: Array<{ title: string; data: Record<string, unknown>; plugin: PluginInfo | null }> = [];

  for (const line of shippingLines) {
    if (line.meta_data) {
      for (const meta of line.meta_data) {
        if (!isVisibleMeta(meta)) continue;

        const parsedValue = parseJsonSafely(meta.value);
        if (typeof parsedValue === 'object' && parsedValue !== null) {
          const plugin = detectPlugin(String(meta.key));
          shippingMeta.push({
            title: formatMetaKey(String(meta.key)),
            data: parsedValue as Record<string, unknown>,
            plugin,
          });
        }
      }
    }
  }

  // Check if there's any data to show
  const hasOrderMeta = Object.keys(groupedMeta).length > 0;
  const hasShippingMeta = shippingMeta.length > 0;

  if (!hasOrderMeta && !hasShippingMeta) {
    return null;
  }

  // Generate WP Admin URL for order
  const wpAdminUrl = storeUrl && orderId
    ? `${storeUrl.replace(/\/$/, '')}/wp-admin/post.php?post=${orderId}&action=edit`
    : null;

  const handleOpenWpAdmin = (): void => {
    if (wpAdminUrl) {
      if (onOpenWpAdmin) {
        onOpenWpAdmin(wpAdminUrl);
      } else {
        // Fallback: open in default browser
        window.open(wpAdminUrl, '_blank');
      }
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden transition-colors">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Package className="w-5 h-5" />
              Данни от плъгини
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Автоматично разпознати данни от WooCommerce разширения
            </p>
          </div>
          {wpAdminUrl && (
            <button
              onClick={handleOpenWpAdmin}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Управление в WP
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Shipping plugin data (formatted cards) */}
        {shippingMeta.map((item, idx) => (
          <ShippingCard
            key={idx}
            data={item.data}
            plugin={item.plugin}
            title={item.title}
          />
        ))}

        {/* Order meta grouped by plugin */}
        {Object.entries(groupedMeta).map(([groupName, items]) => {
          const firstPlugin = items[0]?.plugin;

          // Check if any item has complex JSON data
          const hasComplexData = items.some(item => typeof item.value === 'object');

          if (hasComplexData) {
            // Render as cards for complex data
            return items.map((item, idx) => {
              if (typeof item.value === 'object' && item.value !== null) {
                return (
                  <ShippingCard
                    key={`${groupName}-${idx}`}
                    data={item.value as Record<string, unknown>}
                    plugin={item.plugin}
                    title={formatMetaKey(item.key)}
                  />
                );
              }
              return null;
            });
          }

          // Simple key-value display for simple data
          return (
            <div
              key={groupName}
              className={`rounded-lg border p-4 ${firstPlugin?.color || 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'}`}
            >
              <div className="flex items-center gap-2 mb-3">
                {firstPlugin?.icon || <Package className="w-4 h-4" />}
                <h4 className="font-medium text-gray-900 dark:text-white">{groupName}</h4>
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      {formatMetaKey(item.key)}:
                    </span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {formatValue(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
