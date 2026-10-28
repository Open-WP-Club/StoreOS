import { useState, useEffect, useCallback, ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Server,
  Database,
  Shield,
  Globe,
  Puzzle,
  Palette,
  Settings,
} from 'lucide-react';
import { useStoreConfig } from '../stores';
import WooCommerceService from '../services/woocommerce';
import { useToast } from '../contexts/ToastContext';
import { isInvalidCredentials, loadFailureMessage, openSetupAction } from '../utils/loadErrors';
import type { SystemStatus } from '../types';
import type {
  WooCommercePaymentGateway,
  WooCommerceShippingZone,
  WooCommerceWebhook,
} from '../services/woocommerce/admin';

type HealthStatus = 'good' | 'warning' | 'error';

interface HealthCheck {
  label: string;
  value: string;
  status: HealthStatus;
  detail?: string;
}

function StatusIcon({ status }: { status: HealthStatus }): ReactElement {
  switch (status) {
    case 'good':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case 'error':
      return <XCircle className="w-4 h-4 text-red-500" />;
  }
}

function getPhpVersionStatus(version: string): HealthStatus {
  const parts = version.split('.');
  const major = parseInt(parts[0] ?? '0', 10);
  const minor = parseInt(parts[1] ?? '0', 10);
  if (major >= 8 && minor >= 1) return 'good';
  if (major >= 8) return 'warning';
  return 'error';
}

function getWpVersionStatus(version: string): HealthStatus {
  const major = parseFloat(version);
  if (major >= 6.4) return 'good';
  if (major >= 6.0) return 'warning';
  return 'error';
}

function getWcVersionStatus(version: string): HealthStatus {
  const major = parseFloat(version);
  if (major >= 8.0) return 'good';
  if (major >= 7.0) return 'warning';
  return 'error';
}

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function StoreHealthPage(): ReactElement | null {
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const activeStore = getCurrentStore();
  const toast = useToast();
  const navigate = useNavigate();

  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [integrations, setIntegrations] = useState<{
    gateways: WooCommercePaymentGateway[];
    zones: WooCommerceShippingZone[];
    webhooks: WooCommerceWebhook[];
  } | null>(null);

  const fetchHealth = useCallback(async () => {
    if (!activeStore) return;
    setLoading(true);
    setError(null);
    try {
      const service = new WooCommerceService(activeStore);
      const result = await service.testConnection();
      if (result.success) {
        setSystemStatus(result.data);
        setLastChecked(new Date());
        // Optional extras: a key without access to these endpoints just hides the section
        const [gateways, zones, webhooks] = await Promise.all([
          service.getPaymentGateways(),
          service.getShippingZones(),
          service.getWebhooks(),
        ]);
        setIntegrations(
          gateways.success && zones.success && webhooks.success
            ? { gateways: gateways.data, zones: zones.data, webhooks: webhooks.data }
            : null
        );
      } else {
        setError(result.error || 'Failed to fetch system status');
        if (isInvalidCredentials(result)) {
          toast.error(
            loadFailureMessage('store health', result),
            8000,
            openSetupAction(navigate)
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [activeStore, toast, navigate]);

  useEffect(() => {
    void Promise.resolve().then(fetchHealth);
  }, [fetchHealth]);

  if (!activeStore) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Please configure a store first.</p>
      </div>
    );
  }

  if (loading && !systemStatus) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Checking store health...</p>
        </div>
      </div>
    );
  }

  if (error && !systemStatus) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Store Health</h1>
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <XCircle className="w-6 h-6 text-red-500" />
            <h2 className="text-lg font-semibold text-red-800 dark:text-red-400">Connection Failed</h2>
          </div>
          <p className="text-red-700 dark:text-red-300 text-sm mb-4">{error}</p>
          <button
            onClick={fetchHealth}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!systemStatus) return null;

  const env = systemStatus.environment;
  const db = systemStatus.database;
  const theme = systemStatus.theme;
  const settings = systemStatus.settings;
  const plugins = systemStatus.active_plugins || [];

  // Build health checks
  const environmentChecks: HealthCheck[] = [
    {
      label: 'WordPress Version',
      value: env.wp_version,
      status: getWpVersionStatus(env.wp_version),
      detail: parseFloat(env.wp_version) < 6.0 ? 'Update recommended' : undefined,
    },
    {
      label: 'WooCommerce Version',
      value: env.wc_version,
      status: getWcVersionStatus(env.wc_version),
      detail: parseFloat(env.wc_version) < 7.0 ? 'Update recommended' : undefined,
    },
    {
      label: 'PHP Version',
      value: env.php_version,
      status: getPhpVersionStatus(env.php_version),
      detail: parseInt(env.php_version.split('.')[0] ?? '0', 10) < 8 ? 'PHP 8.1+ recommended' : undefined,
    },
    {
      label: 'MySQL Version',
      value: env.mysql_version,
      status: 'good',
    },
    {
      label: 'Memory Limit',
      value: formatBytes(env.wp_memory_limit),
      status: env.wp_memory_limit >= 268435456 ? 'good' : env.wp_memory_limit >= 134217728 ? 'warning' : 'error',
      detail: env.wp_memory_limit < 134217728 ? 'Increase to at least 256MB' : undefined,
    },
    {
      label: 'Debug Mode',
      value: env.wp_debug_mode ? 'Enabled' : 'Disabled',
      status: env.wp_debug_mode ? 'warning' : 'good',
      detail: env.wp_debug_mode ? 'Should be disabled in production' : undefined,
    },
    {
      label: 'WP Cron',
      value: env.wp_cron ? 'Enabled' : 'Disabled',
      status: env.wp_cron ? 'good' : 'warning',
      detail: !env.wp_cron ? 'Scheduled tasks may not run' : undefined,
    },
    {
      label: 'cURL Enabled',
      value: env.fsockopen_or_curl_enabled ? 'Yes' : 'No',
      status: env.fsockopen_or_curl_enabled ? 'good' : 'error',
    },
    {
      label: 'Multisite',
      value: env.wp_multisite ? 'Yes' : 'No',
      status: 'good',
    },
  ];

  const securityChecks: HealthCheck[] = [
    {
      label: 'Force SSL',
      value: settings.force_ssl ? 'Enabled' : 'Disabled',
      status: settings.force_ssl ? 'good' : 'warning',
      detail: !settings.force_ssl ? 'HTTPS recommended for security' : undefined,
    },
    {
      label: 'REST API',
      value: settings.api_enabled ? 'Enabled' : 'Disabled',
      status: settings.api_enabled ? 'good' : 'error',
      detail: !settings.api_enabled ? 'API must be enabled for this app' : undefined,
    },
  ];

  const overallStatus: HealthStatus = [
    ...environmentChecks,
    ...securityChecks,
  ].some((c) => c.status === 'error')
    ? 'error'
    : [...environmentChecks, ...securityChecks].some((c) => c.status === 'warning')
      ? 'warning'
      : 'good';

  const overallLabel =
    overallStatus === 'good' ? 'All systems operational' :
    overallStatus === 'warning' ? 'Some items need attention' :
    'Critical issues detected';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Store Health</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {activeStore.name} &mdash; {activeStore.url}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastChecked && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Last checked: {lastChecked.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Overall Status Banner */}
      <div
        className={`mb-6 p-4 rounded-lg border flex items-center gap-3 ${
          overallStatus === 'good'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : overallStatus === 'warning'
              ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}
      >
        <StatusIcon status={overallStatus} />
        <span
          className={`font-semibold ${
            overallStatus === 'good'
              ? 'text-green-800 dark:text-green-400'
              : overallStatus === 'warning'
                ? 'text-yellow-800 dark:text-yellow-400'
                : 'text-red-800 dark:text-red-400'
          }`}
        >
          {overallLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Environment */}
        <HealthSection icon={Server} title="Environment" checks={environmentChecks} />

        {/* Security */}
        <HealthSection icon={Shield} title="Security & API" checks={securityChecks} />

        {/* Store Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Store Settings</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            <InfoRow label="Currency" value={`${settings.currency} (${settings.currency_symbol})`} />
            <InfoRow label="Currency Position" value={settings.currency_position} />
            <InfoRow label="Thousand Separator" value={`"${settings.thousand_separator}"`} />
            <InfoRow label="Decimal Separator" value={`"${settings.decimal_separator}"`} />
            <InfoRow label="Decimals" value={String(settings.number_of_decimals)} />
            <InfoRow label="Timezone" value={env.default_timezone} />
            <InfoRow label="Language" value={env.language} />
          </div>
        </div>

        {/* Database */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex items-center gap-2">
            <Database className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Database</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            <InfoRow label="WC DB Version" value={db.wc_database_version} />
            <InfoRow label="DB Prefix" value={db.database_prefix} />
          </div>
        </div>

        {/* Theme */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex items-center gap-2">
            <Palette className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Active Theme</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            <InfoRow label="Name" value={theme.name} />
            <InfoRow label="Version" value={theme.version} />
            <InfoRow label="Child Theme" value={theme.is_child_theme ? 'Yes' : 'No'} />
            <div className="px-5 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">WooCommerce Support</span>
              <span className="flex items-center gap-1.5">
                {theme.has_woocommerce_support ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {theme.has_woocommerce_support ? 'Yes' : 'No'}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Server Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex items-center gap-2">
            <Globe className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Server</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            <InfoRow label="Server Software" value={env.server_info} />
            <InfoRow label="cURL Version" value={env.curl_version} />
            <InfoRow label="Home URL" value={env.home_url} />
            <InfoRow label="Site URL" value={env.site_url} />
          </div>
        </div>

        {/* Integrations */}
        {integrations && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden lg:col-span-2">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex items-center gap-2">
              <Puzzle className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Integrations</h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              <InfoRow
                label="Payment gateways"
                value={
                  integrations.gateways
                    .filter((g) => g.enabled)
                    .map((g) => g.title)
                    .join(', ') || 'None enabled'
                }
              />
              <InfoRow label="Shipping zones" value={String(integrations.zones.length)} />
              <InfoRow
                label="Webhooks"
                value={
                  integrations.webhooks.length === 0
                    ? 'None'
                    : `${integrations.webhooks.filter((w) => w.status === 'active').length} active / ${integrations.webhooks.length} total`
                }
              />
            </div>
          </div>
        )}

        {/* Active Plugins */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden lg:col-span-2">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex items-center gap-2">
            <Puzzle className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Active Plugins ({plugins.length})
            </h2>
          </div>
          {plugins.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50">
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Version</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Author</th>
                    <th className="px-5 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Network</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {plugins.map((plugin, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-5 py-2.5 text-gray-900 dark:text-white font-medium">{plugin.name}</td>
                      <td className="px-5 py-2.5 text-gray-600 dark:text-gray-400">{plugin.version}</td>
                      <td className="px-5 py-2.5 text-gray-600 dark:text-gray-400">{plugin.author}</td>
                      <td className="px-5 py-2.5 text-center">
                        {plugin.network_activated && (
                          <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                            Network
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
              No plugin information available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HealthSection({
  icon: Icon,
  title,
  checks,
}: {
  icon: typeof Server;
  title: string;
  checks: HealthCheck[];
}): ReactElement {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex items-center gap-2">
        <Icon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {checks.map((check, i) => (
          <div key={i} className="px-5 py-3 flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">{check.label}</span>
              {check.detail && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{check.detail}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">{check.value}</span>
              <StatusIcon status={check.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="px-5 py-3 flex items-center justify-between">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[60%] text-right">
        {value}
      </span>
    </div>
  );
}

export default StoreHealthPage;
