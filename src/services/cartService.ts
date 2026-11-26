import { CartItem, Product, ProductVariant } from '../types';
import { getItem, setItem, STORAGE_KEYS } from '../utilities/storage';
import { promotionService } from './promotionService';

export const cartService = {
  getCart(): CartItem[] {
    const rawItems = getItem<CartItem[]>(STORAGE_KEYS.CART, []);
    return this.revalidateCartPrices(rawItems);
  },

  // Recalculates product prices against live active promotions and discounts
  revalidateCartPrices(items: CartItem[]): CartItem[] {
    let changed = false;
    const refreshed = items.map((item) => {
      const priceResult = promotionService.calculateProductPrice(item.product, item.selectedVariant?.id);
      if (
        item.unitPrice !== priceResult.finalPrice ||
        item.originalPrice !== priceResult.originalPrice ||
        item.discountAmount !== priceResult.discountAmount
      ) {
        changed = true;
        return {
          ...item,
          unitPrice: priceResult.finalPrice,
          originalPrice: priceResult.originalPrice,
          discountAmount: priceResult.discountAmount,
          appliedDiscountId: priceResult.appliedDiscount?.id,
          badgeText: priceResult.badgeText,
          lineTotal: item.quantity * priceResult.finalPrice,
        };
      }
      return item;
    });

    if (changed) {
      setItem(STORAGE_KEYS.CART, refreshed);
    }
    return refreshed;
  },

  saveCart(items: CartItem[]): void {
    setItem(STORAGE_KEYS.CART, items);
    window.dispatchEvent(new Event('quantum_cart_updated'));
  },

  addToCart(
    product: Product,
    variant?: ProductVariant,
    quantity: number = 1
  ): { success: boolean; items: CartItem[]; error?: string; updatedItem?: CartItem } {
    const items = getItem<CartItem[]>(STORAGE_KEYS.CART, []);
    const availableStock = variant ? variant.stock : product.stock;

    if (availableStock <= 0) {
      return {
        success: false,
        items,
        error: 'Product is currently out of stock.',
      };
    }

    const itemId = variant ? `${product.id}-${variant.id}` : product.id;
    const priceResult = promotionService.calculateProductPrice(product, variant?.id);
    const unitPrice = priceResult.finalPrice;
    const originalPrice = priceResult.originalPrice;
    const discountAmount = priceResult.discountAmount;
    const appliedDiscountId = priceResult.appliedDiscount?.id;
    const badgeText = priceResult.badgeText;
    const existingIndex = items.findIndex(i => i.id === itemId);

    let updatedItem: CartItem;

    if (existingIndex >= 0) {
      const existing = items[existingIndex];
      const newQty = existing.quantity + quantity;

      if (newQty > availableStock) {
        return {
          success: false,
          items,
          error: `Cannot add more. Maximum available stock is ${availableStock}.`,
        };
      }

      updatedItem = {
        ...existing,
        unitPrice,
        originalPrice,
        discountAmount,
        appliedDiscountId,
        badgeText,
        quantity: newQty,
        lineTotal: newQty * unitPrice,
      };
      items[existingIndex] = updatedItem;
    } else {
      const actualQty = Math.min(quantity, availableStock);
      updatedItem = {
        id: itemId,
        product,
        selectedVariant: variant,
        quantity: actualQty,
        unitPrice,
        originalPrice,
        discountAmount,
        appliedDiscountId,
        badgeText,
        lineTotal: actualQty * unitPrice,
      };
      items.push(updatedItem);
    }

    this.saveCart(items);
    return { success: true, items, updatedItem };
  },

  updateQuantity(
    itemId: string,
    quantity: number
  ): { success: boolean; items: CartItem[]; error?: string } {
    if (quantity <= 0) {
      return { success: true, items: this.removeFromCart(itemId) };
    }

    const items = this.getCart();
    const index = items.findIndex(i => i.id === itemId);

    if (index === -1) {
      return { success: false, items, error: 'Item not found in cart.' };
    }

    const currentItem = items[index];
    const maxStock = currentItem.selectedVariant
      ? currentItem.selectedVariant.stock
      : currentItem.product.stock;

    let warning: string | undefined;
    let finalQty = quantity;

    if (quantity > maxStock) {
      finalQty = maxStock;
      warning = `Only ${maxStock} items available in stock.`;
    }

    items[index] = {
      ...currentItem,
      quantity: finalQty,
      lineTotal: finalQty * currentItem.unitPrice,
    };

    this.saveCart(items);
    return { success: true, items, error: warning };
  },

  removeFromCart(itemId: string): CartItem[] {
    const items = this.getCart().filter(i => i.id !== itemId);
    this.saveCart(items);
    return items;
  },

  clearCart(): void {
    this.saveCart([]);
  },

  calculateTotals(items: CartItem[], deliveryFee: number = 0, discount: number = 0) {
    const totalCount = items.reduce((acc, item) => acc + item.quantity, 0);
    const subtotal = items.reduce((acc, item) => acc + item.lineTotal, 0);
    const total = Math.max(0, subtotal + deliveryFee - discount);

    return { totalCount, subtotal, total };
  },
};
