import axios from 'axios';
import type {
  AddToCartResponse,
  CartModel,
  CreateOrderResponse,
  DeliveryAddress,
  FacetProductResponse,
  LoginResponse,
  Menu,
  OrderModel,
  PaymentOption,
  ProductModel,
  ProfileModel,
  RegisterRequest,
  ShippingOptionsResponse,
  WishlistDetailModel,
  WishlistModel,
} from './types';
import type { Category } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5135';
const STORE_KEY = import.meta.env.VITE_STORE_API_KEY;

if (!STORE_KEY) {
  // eslint-disable-next-line no-console
  console.error('VITE_STORE_API_KEY is not set - every API call will be rejected with 401 store_key_missing.');
}

const SESSION_REF_STORAGE_KEY = 'session_ref';
const AUTH_TOKEN_STORAGE_KEY = 'auth_token';

export const getSessionRef = () => localStorage.getItem(SESSION_REF_STORAGE_KEY) || '';
export const getToken = () => localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || '';
export const setToken = (token: string) => localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
export const clearToken = () => localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);

const http = axios.create({
  baseURL: `${API_URL}/api/v1/store`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  config.headers['X-Commerce-Key'] = STORE_KEY;

  const sessionRef = getSessionRef();
  if (sessionRef) config.headers['X-Session-Ref'] = sessionRef;

  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  return config;
});

http.interceptors.response.use(
  (response) => {
    // Contract: always send back whatever X-Session-Ref was last received (see SessionReferenceMiddleware).
    const sessionRef = response.headers['x-session-ref'];
    if (sessionRef) localStorage.setItem(SESSION_REF_STORAGE_KEY, sessionRef);
    return response;
  },
  (error) => {
    const sessionRef = error.response?.headers?.['x-session-ref'];
    if (sessionRef) localStorage.setItem(SESSION_REF_STORAGE_KEY, sessionRef);
    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const auth = {
  login: (email: string, password: string) =>
    http.post<LoginResponse>('/auth/login', { email, password }).then((r) => r.data),

  register: (data: RegisterRequest) =>
    http.post<LoginResponse | { message: string }>('/auth/register', data).then((r) => r.data),

  logout: () => http.post('/auth/logout').then((r) => r.data),

  refreshToken: (refreshToken: string) =>
    http.post<LoginResponse>('/auth/refresh-token', { refreshToken }).then((r) => r.data),

  forgotPassword: (email: string) => http.post('/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (email: string, hash: string, otp: string, newPassword: string) =>
    http.post('/auth/reset-password', { email, hash, otp, newPassword }).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const catalog = {
  getCategories: () => http.get<{ categories: Category[] }>('/catalog/categories').then((r) => r.data.categories),

  getCategory: (id: number) => http.get<Category>(`/catalog/categories/${id}`).then((r) => r.data),

  getMenu: (type: 'main' | 'footer') => http.get<Menu>(`/catalog/menu/${type}`).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchParams {
  keywords?: string;
  page?: number;
  limit?: number;
  sort?: string;
  filters?: string;
}

export const search = {
  getProducts: (params: SearchParams = {}) =>
    http.get<FacetProductResponse>('/search/products', { params }).then((r) => r.data),

  getSuggestions: (searchTerm: string, limit = 10) =>
    http.get('/search/suggestions', { params: { searchTerm, limit } }).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export const products = {
  getById: (id: number) => http.get<ProductModel>(`/products/${id}`).then((r) => r.data),
  getBySku: (sku: string) => http.get<ProductModel>(`/products/by-sku/${encodeURIComponent(sku)}`).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

export const cart = {
  get: () => http.get<CartModel>('/cart').then((r) => (r.status === 204 ? null : r.data)),

  addItem: (productId: number, qty: number) =>
    http.post<AddToCartResponse>('/cart/items', { productId, qty }).then((r) => r.data),

  updateItem: (itemId: number, qty: number) =>
    http.patch<CartModel>(`/cart/items/${itemId}`, { qty }).then((r) => (r.status === 204 ? null : r.data)),

  removeItem: (itemId: number) =>
    http.delete<CartModel>(`/cart/items/${itemId}`).then((r) => (r.status === 204 ? null : r.data)),

  clear: () => http.delete('/cart').then((r) => r.data),

  addPromoCode: (code: string) => http.post('/cart/promo-codes', { code }).then((r) => r.data),

  removePromoCode: (code: string) => http.delete(`/cart/promo-codes/${encodeURIComponent(code)}`).then((r) => r.data),

  validate: () => http.get('/cart/validate').then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

export interface ContactDetailsInput {
  Email: string;
  Name?: string;
  Phone?: string;
}

export interface DeliveryAddressInput {
  addressId?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address1?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  countryId?: number;
}

export const checkout = {
  getPaymentOptions: () => http.get<PaymentOption[]>('/checkout/payment-options').then((r) => r.data),

  getShippingOptions: () => http.get<ShippingOptionsResponse>('/checkout/shipping-options').then((r) => r.data),

  getDeliveryAddresses: () => http.get<DeliveryAddress[]>('/checkout/addresses/delivery').then((r) => r.data),

  setDeliveryAddress: (address: DeliveryAddressInput) =>
    http.post('/checkout/delivery-address', address).then((r) => r.data),

  setShippingOption: (shippingSystemName: string, service: string, quote: string, quoteNumeric: number) =>
    http.post('/checkout/shipping-option', { shippingSystemName, service, quote, quoteNumeric }).then((r) => r.data),

  setPaymentOption: (paymentSystemName: string) =>
    http.post('/checkout/payment-option', { paymentSystemName }).then((r) => r.data),

  setContactDetails: (details: ContactDetailsInput) =>
    http.post('/checkout/contact-details', details).then((r) => r.data),

  createOrder: (checksum: string, paymentMethodName: string, returnUrl?: string) =>
    http
      .post<CreateOrderResponse>('/checkout/orders', { checksum, paymentMethodName, returnUrl })
      .then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const orders = {
  list: (page = 0, pageSize = 20) =>
    http.get<OrderModel[]>('/orders', { params: { page, pageSize } }).then((r) => r.data),

  get: (orderId: number) => http.get<OrderModel>(`/orders/${orderId}`).then((r) => r.data),

  cancel: (orderId: number) => http.post(`/orders/${orderId}/cancel`).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export const profile = {
  get: () => http.get<ProfileModel>('/profile').then((r) => r.data),
  update: (data: Partial<ProfileModel>) => http.patch('/profile', data).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Wishlists
// ---------------------------------------------------------------------------

export const wishlists = {
  list: () => http.get<WishlistModel[]>('/wishlists').then((r) => r.data),

  get: (documentRef: string) => http.get<WishlistDetailModel>(`/wishlists/${documentRef}`).then((r) => r.data),

  create: (name?: string) =>
    http.post<{ documentId: number; documentRef: string }>('/wishlists', { name }).then((r) => r.data),

  addItem: (wishlistId: number, productId: number, qty = 1) =>
    http.post(`/wishlists/${wishlistId}/items`, { productId, qty }).then((r) => r.data),

  removeItem: (wishlistId: number, lineId: number) =>
    http.delete(`/wishlists/${wishlistId}/items/${lineId}`).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export const payments = {
  getStatus: (orderRef: string) =>
    http
      .get<{ orderRef: string; orderStatus: string; paymentStatus: string; paid: boolean }>(`/payments/${orderRef}/status`)
      .then((r) => r.data),
};

export { http };
