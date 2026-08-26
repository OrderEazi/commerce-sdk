import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { cart as cartApi } from '../lib/api';
import type { AddToCartResponse, CartModel } from '../lib/types';

interface CartContextType {
  cart: CartModel | null;
  loading: boolean;
  itemCount: number;
  refresh: () => Promise<void>;
  addItem: (productId: number, qty: number) => Promise<AddToCartResponse>;
  updateItem: (itemId: number, qty: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clear: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartModel | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await cartApi.get();
    setCart(data);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const addItem = useCallback(async (productId: number, qty: number) => {
    const response = await cartApi.addItem(productId, qty);
    // A rejected add (e.g. below minimum order quantity, product has no price) still comes back as a
    // 200 with success:false and no `cart` field - only replace cart state on genuine success, otherwise
    // the existing cart would be wiped out from under the user.
    if (response.success) setCart(response.cart ?? null);
    return response;
  }, []);

  const updateItem = useCallback(async (itemId: number, qty: number) => {
    const updated = await cartApi.updateItem(itemId, qty);
    setCart(updated);
  }, []);

  const removeItem = useCallback(async (itemId: number) => {
    const updated = await cartApi.removeItem(itemId);
    setCart(updated);
  }, []);

  const clear = useCallback(async () => {
    await cartApi.clear();
    setCart(null);
  }, []);

  return (
    <CartContext.Provider
      value={{ cart, loading, itemCount: cart?.itemCount ?? 0, refresh, addItem, updateItem, removeItem, clear }}
    >
      {children}
    </CartContext.Provider>
  );
}
