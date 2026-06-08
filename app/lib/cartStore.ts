import React, { createContext, useContext, useState, useCallback } from 'react';
import { CartItem } from './types';

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  totalItems: 0,
  totalPrice: 0,
});

export function useCart() {
  return useContext(CartContext);
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((newItem: CartItem) => {
    setItems(prev => {
      const safeItem = { ...newItem, price: Number(newItem.price) || 0 };
      const existing = prev.find(i => i.id === safeItem.id);
      if (existing) {
        return prev.map(i =>
          i.id === safeItem.id
            ? { ...i, quantity: i.quantity + safeItem.quantity }
            : i
        );
      }
      return [...prev, safeItem];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => i.id !== id));
    } else {
      setItems(prev =>
        prev.map(i => (i.id === id ? { ...i, quantity } : i))
      );
    }
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + (Number(i.price) || 0) * i.quantity, 0);

  return React.createElement(
    CartContext.Provider,
    {
      value: { items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice },
    },
    children
  );
}
