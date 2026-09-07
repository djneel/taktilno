"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  createContext,
  type ReactNode,
} from "react";

export type CartItem = {
  productId: number;
  slug: string;
  name: string;
  price: number;
  imageUrl: string | null;
  category: string | null;
  quantity: number;
  stock: number;
  variantName?: string;
};

type CartState = {
  items: CartItem[];
  hydrated: boolean;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (productId: number, variantName?: string) => void;
  setQuantity: (productId: number, quantity: number, variantName?: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  lastAdded: CartItem | null;
  dismissToast: () => void;
};

const CartContext = createContext<CartState | null>(null);
const STORAGE_KEY = "taktilno_cart_v1";

const EMPTY: CartItem[] = [];
let snapshot: CartItem[] = EMPTY;
const listeners = new Set<() => void>();

function readStoredCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

if (typeof window !== "undefined") {
  snapshot = readStoredCart();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return EMPTY;
}

function emit(next: CartItem[]) {
  snapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

function sameItem(a: CartItem, productId: number, variantName?: string) {
  return a.productId === productId && a.variantName === variantName;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useHydrated();
  const [lastAdded, setLastAdded] = useState<CartItem | null>(null);

  useEffect(() => {
    if (!lastAdded) return;
    const t = setTimeout(() => setLastAdded(null), 2600);
    return () => clearTimeout(t);
  }, [lastAdded]);

  const addItem = useCallback((item: Omit<CartItem, "quantity">, quantity = 1) => {
    const existing = snapshot.find((i) => sameItem(i, item.productId, item.variantName));
    const max = item.stock > 0 ? item.stock : 99;
    const next = existing
      ? snapshot.map((i) =>
          sameItem(i, item.productId, item.variantName)
            ? { ...i, ...item, quantity: Math.min(max, i.quantity + quantity) }
            : i
        )
      : [...snapshot, { ...item, quantity: Math.min(max, quantity) }];
    emit(next);
    setLastAdded({ ...item, quantity });
  }, []);

  const removeItem = useCallback((productId: number, variantName?: string) => {
    emit(snapshot.filter((i) => !sameItem(i, productId, variantName)));
  }, []);

  const setQuantity = useCallback((productId: number, quantity: number, variantName?: string) => {
    emit(
      snapshot
        .map((i) =>
          sameItem(i, productId, variantName)
            ? { ...i, quantity: Math.max(0, Math.min(i.stock > 0 ? i.stock : 99, quantity)) }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const clear = useCallback(() => emit([]), []);

  const value = useMemo<CartState>(() => {
    const count = items.reduce((s, i) => s + i.quantity, 0);
    const subtotal = items.reduce((s, i) => s + i.quantity * i.price, 0);
    return {
      items,
      hydrated,
      addItem,
      removeItem,
      setQuantity,
      clear,
      count,
      subtotal,
      lastAdded,
      dismissToast: () => setLastAdded(null),
    };
  }, [items, hydrated, addItem, removeItem, setQuantity, clear, lastAdded]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
