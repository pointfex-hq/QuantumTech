import { Category, Order, OrderItem, Product, Review, StoreSettings } from '../types';
import { getItem, setItem, STORAGE_KEYS } from '../utilities/storage';

const TOKEN_KEY = 'qt_admin_token';
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ? import.meta.env.VITE_API_URL : '';

let connected = false;

export function isBackendConnected(): boolean {
  return connected;
}

export function getAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getAdminToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const response = await fetch(url, { ...options, headers });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.error || data?.message || response.statusText || 'Request failed';
    throw new ApiError(message, response.status, data?.code);
  }
  return data as T;
}

type RawProduct = Product & { featured?: boolean; new?: boolean };

export function fromApiProduct(raw: RawProduct): Product {
  return {
    ...raw,
    isFeatured: Boolean(raw.isFeatured ?? raw.featured),
    isNew: Boolean(raw.isNew ?? raw.new),
    images: raw.images || [],
    tags: raw.tags || [],
    variants: raw.variants || [],
    specifications: raw.specifications || {},
    status: raw.status || 'Active',
  };
}

function publish(name: string): void {
  window.dispatchEvent(new Event(name));
}

function saveList<T>(key: string, value: T, event: string): void {
  setItem(key, value);
  publish(event);
}

export async function connectBackend(): Promise<boolean> {
  try {
    const probe = await fetch(`${API_BASE}/api/settings`, { signal: AbortSignal.timeout(3000) });
    if (!probe.ok) {
      connected = false;
      return false;
    }
    connected = true;
    await refreshPublicCatalog();
    if (getAdminToken()) {
      await refreshAdminCatalog().catch(() => setAdminToken(null));
    }
    return true;
  } catch {
    connected = false;
    return false;
  }
}

export async function refreshPublicCatalog(): Promise<void> {
  const [settings, products, categories, reviews] = await Promise.all([
    api<StoreSettings>('/api/settings'),
    api<RawProduct[]>('/api/products'),
    api<Category[]>('/api/categories'),
    api<Review[]>('/api/reviews'),
  ]);

  const currentSettings = getItem<StoreSettings | null>(STORAGE_KEYS.SETTINGS, null);
  saveList(
    STORAGE_KEYS.SETTINGS,
    { ...(currentSettings || {}), ...settings },
    'quantum_settings_updated'
  );

  if (products.length > 0) {
    saveList(STORAGE_KEYS.PRODUCTS, products.map(fromApiProduct), 'quantum_products_updated');
  }
  if (categories.length > 0) {
    const existing = getItem<Category[]>(STORAGE_KEYS.CATEGORIES, []);
    const hidden = existing.filter((c) => c.status === 'Hidden');
    const visibleIds = new Set(categories.map((c) => c.id));
    saveList(
      STORAGE_KEYS.CATEGORIES,
      [...categories, ...hidden.filter((c) => !visibleIds.has(c.id))],
      'quantum_categories_updated'
    );
  }
  if (getAdminToken()) return;
  saveList(STORAGE_KEYS.REVIEWS, reviews, 'quantum_reviews_updated');
}

export async function refreshAdminCatalog(): Promise<void> {
  const [products, categories, reviews, orders] = await Promise.all([
    api<RawProduct[]>('/api/admin/products'),
    api<Category[]>('/api/admin/categories'),
    api<Review[]>('/api/admin/reviews'),
    api<Order[]>('/api/admin/orders'),
  ]);
  saveList(STORAGE_KEYS.PRODUCTS, products.map(fromApiProduct), 'quantum_products_updated');
  saveList(STORAGE_KEYS.CATEGORIES, categories, 'quantum_categories_updated');
  saveList(STORAGE_KEYS.REVIEWS, reviews, 'quantum_reviews_updated');
  saveList(STORAGE_KEYS.ORDERS, orders, 'quantum_orders_updated');
}

export function rememberOrder(order: Order): void {
  const orders = getItem<Order[]>(STORAGE_KEYS.ORDERS, []);
  const index = orders.findIndex((o) => o.id === order.id || o.orderNumber === order.orderNumber);
  if (index >= 0) orders[index] = order;
  else orders.unshift(order);
  saveList(STORAGE_KEYS.ORDERS, orders, 'quantum_orders_updated');
}

export function mapPublicOrder(raw: Record<string, unknown>, language: 'en' | 'bn'): Order {
  const items = ((raw.items as Array<Record<string, unknown>>) || []).map((item, index) => ({
    id: `oi-${raw.id}-${index}`,
    orderId: String(raw.id || ''),
    productId: String(item.productId || ''),
    variantId: item.variantId ? String(item.variantId) : undefined,
    productName: String(item.productName || ''),
    variantName: item.variantName ? String(item.variantName) : undefined,
    unitPrice: Number(item.unitPrice || 0),
    quantity: Number(item.quantity || 0),
    lineTotal: Number(item.lineTotal || 0),
    image: String(item.image || ''),
  })) as OrderItem[];

  return {
    id: String(raw.id || ''),
    orderNumber: String(raw.orderNumber || ''),
    customerName: String(raw.customerName || ''),
    phone: String(raw.phone || ''),
    area: raw.area as Order['area'],
    address: String(raw.address || ''),
    note: raw.note ? String(raw.note) : undefined,
    subtotal: Number(raw.subtotal || 0),
    couponDiscount: raw.couponDiscount ? Number(raw.couponDiscount) : undefined,
    deliveryCharge: Number(raw.deliveryCharge || 0),
    total: Number(raw.total || 0),
    paymentMethod: raw.paymentMethod as Order['paymentMethod'],
    paymentStatus: raw.paymentStatus as Order['paymentStatus'],
    trxId: raw.trxId ? String(raw.trxId) : undefined,
    senderNumber: raw.senderNumber ? String(raw.senderNumber) : undefined,
    status: raw.status as Order['status'],
    cancellationReason: raw.cancellationReason ? String(raw.cancellationReason) : undefined,
    language,
    notificationStatus: 'Pending',
    createdAt: String(raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
    items,
  };
}

function quiet(work: Promise<unknown>): void {
  void work.catch((error) => {
    console.error('QuantumTech API sync failed', error);
  });
}

export function syncProduct(product: Product, remove = false): void {
  if (!connected || !getAdminToken()) return;
  if (remove) {
    quiet(api(`/api/admin/products/${product.id}`, { method: 'DELETE' }));
    return;
  }
  quiet(api(`/api/admin/products/${product.id}`, {
    method: 'PUT',
    body: JSON.stringify(product),
  }));
}

export function syncCategory(category: Category, remove = false): void {
  if (!connected || !getAdminToken()) return;
  if (remove) {
    quiet(api(`/api/admin/categories/${category.id}`, { method: 'DELETE' }));
    return;
  }
  quiet(api(`/api/admin/categories/${category.id}`, {
    method: 'PUT',
    body: JSON.stringify(category),
  }));
}

export function syncCategoryOrder(categories: Category[]): void {
  if (!connected || !getAdminToken()) return;
  quiet(api('/api/admin/categories/reorder', {
    method: 'PUT',
    body: JSON.stringify(categories),
  }));
}

export function syncSettings(settings: StoreSettings): void {
  if (!connected || !getAdminToken()) return;
  quiet(api('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  }));
}

export function syncReviewCreate(review: Review): void {
  if (!connected) return;
  quiet(api('/api/reviews', {
    method: 'POST',
    body: JSON.stringify({
      productId: review.productId,
      productName: review.productName,
      reviewerName: review.reviewerName,
      customerEmail: review.customerEmail,
      orderNumber: review.orderNumber,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      images: (review.images || []).filter((img) => img.startsWith('http')),
    }),
  }));
}

export function syncReviewModerate(id: string, status: 'Approved' | 'Rejected'): void {
  if (!connected || !getAdminToken()) return;
  quiet(api(`/api/admin/reviews/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }).then(() => refreshPublicCatalog()));
}

export function syncReviewDelete(id: string): void {
  if (!connected || !getAdminToken()) return;
  quiet(api(`/api/admin/reviews/${id}`, { method: 'DELETE' }));
}

export async function uploadImage(file: File): Promise<string | null> {
  if (!connected || !getAdminToken()) return null;
  const formData = new FormData();
  formData.append('file', file);
  const headers = new Headers();
  const token = getAdminToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE}/api/admin/uploads/image`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!response.ok) {
    throw new ApiError('Image upload failed', response.status);
  }
  const data = (await response.json()) as { url?: string };
  return data.url || null;
}
