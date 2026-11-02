import { useState, type ReactElement } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import useActivityLog from '../stores/activityLogStore';
import { useToast } from '../contexts/ToastContext';
import { WEBHOOK_TOPICS, validateWebhookInput } from '../utils/webhookValidation';
import type WooCommerceService from '../services/woocommerce';
import type { WooCommercePaymentGateway, WooCommerceWebhook } from '../services/woocommerce/admin';
import type { ApiResponse } from '../types';

interface Props {
  service: WooCommerceService;
  storeId: string;
  storeName: string;
  gateways: WooCommercePaymentGateway[];
  webhooks: WooCommerceWebhook[];
  /** Re-fetch after a successful mutation. */
  onChanged: () => void;
}

const input =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm';
const btn = 'px-2.5 py-1 rounded text-xs font-medium disabled:opacity-50';

type Pending =
  | { kind: 'webhook'; hook: WooCommerceWebhook }
  | { kind: 'gateway'; gw: WooCommercePaymentGateway };

function IntegrationsManager({
  service,
  storeId,
  storeName,
  gateways,
  webhooks,
  onChanged,
}: Props): ReactElement {
  const toast = useToast();
  const logActivity = useActivityLog((s) => s.logActivity);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    topic: WEBHOOK_TOPICS[0] as string,
    delivery_url: '',
    secret: '',
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const log = (
    action: 'webhook_created' | 'webhook_updated' | 'webhook_deleted' | 'gateway_toggled',
    entityId: string | number,
    entityName: string,
    details: string
  ): void => {
    logActivity({
      action,
      entityType: 'system',
      entityId,
      entityName,
      storeId,
      storeName,
      details,
    });
  };

  // Shared ApiResponse handling: toast the error, otherwise log + refresh.
  const run = async <T,>(
    call: () => Promise<ApiResponse<T>>,
    ok: () => void,
    successMsg: string
  ): Promise<boolean> => {
    setBusy(true);
    try {
      const res = await call();
      if (!res.success) {
        toast.error(res.error);
        return false;
      }
      ok();
      toast.success(successMsg);
      onChanged();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Request failed');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const toggleHook = (h: WooCommerceWebhook): Promise<boolean> => {
    const next = h.status === 'active' ? 'paused' : 'active';
    return run(
      () => service.setWebhookStatus(h.id, next),
      () => log('webhook_updated', h.id, h.name, `Status: ${h.status} -> ${next}`),
      `Webhook ${next === 'active' ? 'enabled' : 'disabled'}`
    );
  };

  const toggleGateway = (g: WooCommercePaymentGateway): Promise<boolean> =>
    run(
      () => service.setPaymentGatewayEnabled(g.id, !g.enabled),
      () => log('gateway_toggled', g.id, g.title, `Enabled: ${g.enabled} -> ${!g.enabled}`),
      `${g.title} ${g.enabled ? 'disabled' : 'enabled'}`
    );

  const submit = async (): Promise<void> => {
    const errs = validateWebhookInput(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const ok = await run(
      () =>
        service.createWebhook({
          name: form.name.trim(),
          topic: form.topic,
          delivery_url: form.delivery_url.trim(),
          ...(form.secret ? { secret: form.secret } : {}),
        }),
      // Never log the secret.
      () => log('webhook_created', form.name.trim(), form.name.trim(), `Topic: ${form.topic}`),
      'Webhook created'
    );
    if (ok) {
      setShowForm(false);
      setForm({ name: '', topic: WEBHOOK_TOPICS[0], delivery_url: '', secret: '' }); // secret cleared
    }
  };

  const confirm = async (): Promise<void> => {
    if (!pending) return;
    const p = pending;
    setPending(null);
    if (p.kind === 'webhook') {
      await run(
        () => service.deleteWebhook(p.hook.id),
        () => log('webhook_deleted', p.hook.id, p.hook.name, `Topic: ${p.hook.topic}`),
        'Webhook deleted'
      );
    } else {
      await toggleGateway(p.gw);
    }
  };

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      <div className="px-5 py-3">
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">Payment gateways</p>
        {gateways.map((g) => (
          <div key={g.id} className="flex items-center justify-between py-1">
            <span className="text-sm text-gray-600 dark:text-gray-400">{g.title}</span>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                g.enabled ? setPending({ kind: 'gateway', gw: g }) : void toggleGateway(g)
              }
              className={`${btn} ${g.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
            >
              {g.enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        ))}
      </div>

      <div className="px-5 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-900 dark:text-white">Webhooks</p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className={`${btn} bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1`}
          >
            <Plus className="w-3 h-3" /> New webhook
          </button>
        </div>
        {webhooks.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">None</p>}
        {webhooks.map((h) => (
          <div key={h.id} className="flex items-center justify-between gap-3 py-1">
            <div className="min-w-0">
              <p className="text-sm text-gray-900 dark:text-white truncate">{h.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {h.topic} &rarr; {h.delivery_url}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggleHook(h)}
                className={`${btn} ${h.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
              >
                {h.status === 'active' ? 'Active' : h.status}
              </button>
              <button
                type="button"
                disabled={busy}
                aria-label={`Delete webhook ${h.name}`}
                onClick={() => setPending({ kind: 'webhook', hook: h })}
                className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <Modal
          onClose={() => setShowForm(false)}
          aria-label="New webhook"
          className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-3"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">New webhook</h3>
          {(
            [
              ['name', 'Name', 'text'],
              ['delivery_url', 'Delivery URL (https)', 'url'],
              ['secret', 'Secret (optional, write-only)', 'password'],
            ] as const
          ).map(([key, text, type]) => (
            <div key={key}>
              <label
                htmlFor={`wh-${key}`}
                className="block text-sm text-gray-700 dark:text-gray-300 mb-1"
              >
                {text}
              </label>
              <input
                id={`wh-${key}`}
                type={type}
                autoComplete={key === 'secret' ? 'new-password' : 'off'}
                className={input}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
              {errors[key] && <p className="text-xs text-red-600 mt-1">{errors[key]}</p>}
            </div>
          ))}
          <div>
            <label
              htmlFor="wh-topic"
              className="block text-sm text-gray-700 dark:text-gray-300 mb-1"
            >
              Topic
            </label>
            <select
              id="wh-topic"
              className={input}
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
            >
              {WEBHOOK_TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg"
            >
              Create
            </button>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={pending !== null}
        title={pending?.kind === 'webhook' ? 'Delete webhook?' : 'Disable payment gateway?'}
        message={
          pending?.kind === 'webhook'
            ? `"${pending.hook.name}" will be permanently deleted from the store.`
            : pending
              ? `Customers will no longer be able to pay with ${pending.gw.title}.`
              : ''
        }
        confirmLabel={pending?.kind === 'webhook' ? 'Delete' : 'Disable'}
        onConfirm={() => void confirm()}
        onCancel={() => setPending(null)}
        isLoading={busy}
      />
    </div>
  );
}

export default IntegrationsManager;
