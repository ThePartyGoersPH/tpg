import { useEffect, useState } from 'react';

const CART_STORAGE_KEY = 'bar_cart_data';
const CART_EXPIRY_HOURS = 24;

export function useCartPersistence(barId) {
  const [cart, setCart] = useState([]);
  const [reservationData, setReservationData] = useState(null);

  // Load cart from localStorage on mount
  useEffect(() => {
    if (!barId) return;

    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored);
      
      // Check if cart is for the same bar and not expired
      if (parsed.barId === barId) {
        const expiryTime = new Date(parsed.timestamp).getTime() + (CART_EXPIRY_HOURS * 60 * 60 * 1000);
        if (Date.now() < expiryTime) {
          setCart(parsed.cart || []);
          setReservationData(parsed.reservationData || null);
        } else {
          // Expired - clear it
          localStorage.removeItem(CART_STORAGE_KEY);
        }
      }
    } catch (err) {
      console.error('Failed to load cart from localStorage:', err);
      localStorage.removeItem(CART_STORAGE_KEY);
    }
  }, [barId]);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (!barId) return;

    try {
      if (cart.length === 0 && !reservationData) {
        localStorage.removeItem(CART_STORAGE_KEY);
      } else {
        const data = {
          barId,
          cart,
          reservationData,
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(data));
      }
    } catch (err) {
      console.error('Failed to save cart to localStorage:', err);
    }
  }, [barId, cart, reservationData]);

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + (item.quantity || 1) } : i
        );
      }
      return [...prev, { ...item, quantity: item.quantity || 1 }];
    });
  };

  const removeFromCart = (itemId) => {
    setCart((prev) => prev.filter((i) => i.id !== itemId));
  };

  const updateCartQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
    } else {
      setCart((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, quantity } : i))
      );
    }
  };

  const clearCart = () => {
    setCart([]);
    setReservationData(null);
    localStorage.removeItem(CART_STORAGE_KEY);
  };

  const updateReservationData = (data) => {
    setReservationData(data);
  };

  return {
    cart,
    reservationData,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    updateReservationData,
  };
}
