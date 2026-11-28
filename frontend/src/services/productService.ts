import { Product, ProductVariant, Category } from '../types';
import { initialProducts } from '../data/mockData';
import { getItem, setItem, STORAGE_KEYS } from '../utilities/storage';
import { categoryService } from './categoryService';
import { syncProduct } from './backend';

export const productService = {
  // Calculate total stock by summing all variant stocks
  calculateTotalStock(variants?: ProductVariant[]): number {
    if (!variants || variants.length === 0) return 0;
    return variants.reduce((sum, v) => sum + Math.max(0, Math.floor(Number(v.stock) || 0)), 0);
  },

  // Synchronize stock for a product: if it has variants, stock is always the sum of variant stocks
  syncProductStock(prod: Product): Product {
    if (prod.variants && prod.variants.length > 0) {
      const calculated = this.calculateTotalStock(prod.variants);
      if (prod.stock !== calculated) {
        prod.stock = calculated;
      }
    } else {
      prod.stock = Math.max(0, Math.floor(Number(prod.stock) || 0));
    }
    return prod;
  },

  // Storefront catalog: only returns Active products that are not Deleted or Hidden
  getProducts(): Product[] {
    const stored = getItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts);
    return stored
      .map(p => this.syncProductStock(p))
      .filter(p => p.status === 'Active' || !p.status);
  },

  // Admin catalog: returns all products (Active, Hidden)
  getAllProductsAdmin(): Product[] {
    const stored = getItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts);
    return stored
      .map(p => this.syncProductStock(p))
      .filter(p => p.status !== 'Deleted');
  },

  // Lookup product by ID (including hidden products for admin editing)
  getProductById(id: string): Product | undefined {
    const stored = getItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts);
    const prod = stored.find(p => p.id === id);
    return prod ? this.syncProductStock(prod) : undefined;
  },

  // Lookup product by slug
  getProductBySlug(slug: string): Product | undefined {
    const stored = getItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts);
    const prod = stored.find(p => p.slug === slug);
    return prod ? this.syncProductStock(prod) : undefined;
  },

  getCategories(): Category[] {
    return categoryService.getCategories();
  },

  getCategoryBySlug(slug: string): Category | undefined {
    return categoryService.getCategoryBySlug(slug);
  },

  getProductsByCategory(categoryIdOrSlug: string): Product[] {
    const category = this.getCategoryBySlug(categoryIdOrSlug);
    const catId = category ? category.id : categoryIdOrSlug;
    return this.getProducts().filter(p => p.categoryId === catId);
  },

  getRelatedProducts(productId: string, limit: number = 4): Product[] {
    const current = this.getProductById(productId);
    const all = this.getProducts().filter(p => p.id !== productId);
    if (!current) return all.slice(0, limit);

    // Prioritize same category first
    const sameCat = all.filter(p => p.categoryId === current.categoryId);
    const otherCat = all.filter(p => p.categoryId !== current.categoryId);
    return [...sameCat, ...otherCat].slice(0, limit);
  },

  saveProduct(productData: Partial<Product> & { name: string; price: number; stock: number; categoryId: string }): Product {
    const all = getItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts);
    const categories = this.getCategories();
    const cat = categories.find(c => c.id === productData.categoryId);

    const id = productData.id || `prod-${Date.now()}`;
    const slug = productData.slug || productData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Sanitize variants: ensure stock and price are non-negative
    const rawVariants: ProductVariant[] = (productData.variants || []).map(v => ({
      ...v,
      stock: Math.max(0, Math.floor(Number(v.stock) || 0)),
      price: Math.max(0, Number(v.price) || 0),
    }));

    // Automatic Stock Calculation:
    // When variants exist, main product stock = sum of all variant stocks
    // When no variants exist, use the provided stock value
    const calculatedStock = rawVariants.length > 0
      ? this.calculateTotalStock(rawVariants)
      : Math.max(0, Math.floor(Number(productData.stock) || 0));

    const completeProduct: Product = {
      id,
      name: productData.name.trim(),
      nameBn: productData.nameBn?.trim() || productData.name.trim(),
      slug,
      categoryId: productData.categoryId,
      categoryName: cat?.nameEn || productData.categoryName || 'Accessories',
      categoryNameBn: cat?.nameBn || productData.categoryNameBn || 'এক্সেসরিজ',
      description: productData.description || '',
      descriptionBn: productData.descriptionBn || productData.description || '',
      price: Number(productData.price),
      oldPrice: productData.oldPrice ? Number(productData.oldPrice) : undefined,
      stock: calculatedStock,
      images: productData.images && productData.images.length > 0 ? productData.images : [
        'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80'
      ],
      variants: rawVariants,
      specifications: productData.specifications || {},
      specificationsBn: productData.specificationsBn || {},
      rating: productData.rating || 4.8,
      reviewsCount: productData.reviewsCount || 0,
      isFeatured: !!productData.isFeatured,
      isNew: productData.isNew !== undefined ? productData.isNew : true,
      status: productData.status || 'Active',
      tags: productData.tags || [],
    };

    const index = all.findIndex(p => p.id === id);
    if (index >= 0) {
      all[index] = completeProduct;
    } else {
      all.unshift(completeProduct);
    }

    setItem(STORAGE_KEYS.PRODUCTS, all);
    // Dispatch custom event to notify all components in this browser window
    window.dispatchEvent(new Event('quantum_products_updated'));
    syncProduct(completeProduct);
    return completeProduct;
  },

  createProduct(productData: Partial<Product> & { name: string; price: number; stock?: number; categoryId: string }): Product {
    return this.saveProduct({
      ...productData,
      stock: productData.stock ?? 0,
    });
  },

  updateProduct(id: string, updates: Partial<Product>): Product | undefined {
    const all = getItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts);
    const index = all.findIndex(p => p.id === id);
    if (index === -1) return undefined;

    const existing = all[index];
    const sanitizedVariants = updates.variants !== undefined
      ? updates.variants.map(v => ({
          ...v,
          stock: Math.max(0, Math.floor(Number(v.stock) || 0)),
          price: Math.max(0, Number(v.price) || 0),
        }))
      : existing.variants;

    const finalStock = (sanitizedVariants && sanitizedVariants.length > 0)
      ? this.calculateTotalStock(sanitizedVariants)
      : (updates.stock !== undefined ? Math.max(0, Math.floor(Number(updates.stock) || 0)) : existing.stock);

    const updatedProduct: Product = {
      ...existing,
      ...updates,
      variants: sanitizedVariants,
      stock: finalStock,
    };

    all[index] = updatedProduct;
    setItem(STORAGE_KEYS.PRODUCTS, all);
    window.dispatchEvent(new Event('quantum_products_updated'));
    syncProduct(updatedProduct);
    return updatedProduct;
  },

  deductStock(productId: string, quantity: number, variantId?: string): { success: boolean; remainingStock: number; error?: string } {
    if (quantity <= 0) return { success: false, remainingStock: 0, error: 'Quantity must be greater than zero.' };
    const all = getItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts);
    const prod = all.find(p => p.id === productId);
    if (!prod) return { success: false, remainingStock: 0, error: 'Product not found.' };

    if (variantId && prod.variants && prod.variants.length > 0) {
      const variant = prod.variants.find(v => v.id === variantId);
      if (!variant) return { success: false, remainingStock: prod.stock, error: 'Variant not found.' };
      if (variant.stock < quantity) {
        return { success: false, remainingStock: variant.stock, error: `Insufficient variant stock (Available: ${variant.stock}).` };
      }
      variant.stock = Math.max(0, variant.stock - quantity);
      prod.stock = this.calculateTotalStock(prod.variants);
    } else {
      if (prod.stock < quantity) {
        return { success: false, remainingStock: prod.stock, error: `Insufficient product stock (Available: ${prod.stock}).` };
      }
      prod.stock = Math.max(0, prod.stock - quantity);
    }

    setItem(STORAGE_KEYS.PRODUCTS, all);
    window.dispatchEvent(new Event('quantum_products_updated'));
    return { success: true, remainingStock: prod.stock };
  },

  updateProductRating(productId: string, rating: number, reviewsCount: number): void {
    const all = getItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts);
    const prod = all.find(p => p.id === productId);
    if (prod) {
      prod.rating = rating;
      prod.reviewsCount = reviewsCount;
      setItem(STORAGE_KEYS.PRODUCTS, all);
      window.dispatchEvent(new Event('quantum_products_updated'));
    }
  },

  softDeleteProduct(id: string): void {
    const all = getItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts);
    const updated = all.map(p => (p.id === id ? { ...p, status: 'Deleted' as const } : p));
    setItem(STORAGE_KEYS.PRODUCTS, updated);
    window.dispatchEvent(new Event('quantum_products_updated'));
    const removed = updated.find((p) => p.id === id);
    if (removed) syncProduct(removed, true);
  },

  searchProducts(query: string, _lang?: string): Product[] {
    const clean = query.trim().toLowerCase();
    if (!clean) return this.getProducts();

    const terms = clean.split(/\s+/).filter(Boolean);
    
    return this.getProducts().filter(p => {
      const name = p.name.toLowerCase();
      const nameBn = p.nameBn.toLowerCase();
      const cat = p.categoryName.toLowerCase();
      const catBn = p.categoryNameBn.toLowerCase();
      const tags = (p.tags || []).map(t => t.toLowerCase()).join(' ');
      const desc = (p.description || '').toLowerCase();
      const descBn = (p.descriptionBn || '').toLowerCase();

      const combinedText = `${name} ${nameBn} ${cat} ${catBn} ${tags} ${desc} ${descBn}`;

      // All search terms must match somewhere in product data
      return terms.every(term => combinedText.includes(term));
    });
  },
};
