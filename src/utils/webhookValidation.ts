export const WEBHOOK_TOPICS = [
  'order.created',
  'order.updated',
  'order.deleted',
  'order.restored',
  'product.created',
  'product.updated',
  'product.deleted',
  'product.restored',
  'customer.created',
  'customer.updated',
  'customer.deleted',
  'coupon.created',
  'coupon.updated',
  'coupon.deleted',
  'coupon.restored',
] as const;

interface WebhookInput {
  name: string;
  topic: string;
  delivery_url: string;
  secret?: string;
}

/** Returns a map field -> message; empty when valid. */
export function validateWebhookInput(i: WebhookInput): Partial<Record<keyof WebhookInput, string>> {
  const errors: Partial<Record<keyof WebhookInput, string>> = {};
  if (!i.name.trim()) errors.name = 'Name is required';
  if (!(WEBHOOK_TOPICS as readonly string[]).includes(i.topic))
    errors.topic = 'Choose a valid topic';
  try {
    const u = new URL(i.delivery_url.trim());
    if (u.protocol !== 'https:' || !u.hostname || u.username || u.password) {
      errors.delivery_url = 'Delivery URL must be a plain https:// URL';
    }
  } catch {
    errors.delivery_url = 'Delivery URL must be a plain https:// URL';
  }
  if (i.secret && i.secret.length < 8) errors.secret = 'Secret must be at least 8 characters';
  return errors;
}
