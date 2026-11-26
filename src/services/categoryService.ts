import { Category, Product } from '../types';
import { initialCategories, initialProducts } from '../data/mockData';
import { getItem, setItem, STORAGE_KEYS } from '../utilities/storage';

export const categoryService = {
  getCategories(): Category[] {
    const categories = getItem<Category[]>(STORAGE_KEYS.CATEGORIES, initialCategories);
    const products = getItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts).filter(
      p => p.status !== 'Deleted'
    );

    // Compute live product counts
    return categories
      .map(cat => ({
        ...cat,
        productCount: products.filter(p => p.categoryId === cat.id).length,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },

  getCategoryById(id: string): Category | undefined {
    return this.getCategories().find(c => c.id === id);
  },

  getCategoryBySlug(slug: string): Category | undefined {
    return this.getCategories().find(c => c.slug === slug || c.id === slug);
  },

  saveCategory(cat: Category): Category {
    const all = this.getCategories();
    const index = all.findIndex(c => c.id === cat.id);

    if (index >= 0) {
      all[index] = cat;
    } else {
      all.push(cat);
    }

    setItem(STORAGE_KEYS.CATEGORIES, all);
    window.dispatchEvent(new Event('quantum_categories_updated'));
    return cat;
  },

  createCategory(data: Omit<Category, 'id'>): Category {
    const all = this.getCategories();
    const newId = `cat-${Date.now()}`;
    const newCategory: Category = {
      ...data,
      id: newId,
      sortOrder: data.sortOrder || all.length + 1,
    };

    all.push(newCategory);
    setItem(STORAGE_KEYS.CATEGORIES, all);
    window.dispatchEvent(new Event('quantum_categories_updated'));
    return newCategory;
  },

  updateCategory(id: string, data: Partial<Category>): Category | undefined {
    const all = this.getCategories();
    const index = all.findIndex(c => c.id === id);

    if (index === -1) return undefined;

    const updated: Category = {
      ...all[index],
      ...data,
    };

    all[index] = updated;
    setItem(STORAGE_KEYS.CATEGORIES, all);
    window.dispatchEvent(new Event('quantum_categories_updated'));
    return updated;
  },

  reorderCategories(categories: Category[]): void {
    const updated = categories.map((cat, index) => ({
      ...cat,
      sortOrder: index + 1,
    }));
    setItem(STORAGE_KEYS.CATEGORIES, updated);
    window.dispatchEvent(new Event('quantum_categories_updated'));
  },

  deleteCategory(id: string): { success: boolean; error?: string } {
    const products = getItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts).filter(
      p => p.status !== 'Deleted'
    );
    const activeProducts = products.filter(p => p.categoryId === id);

    if (activeProducts.length > 0) {
      return {
        success: false,
        error: `Cannot delete category: Contains ${activeProducts.length} active product(s). Please reassign or delete these products first.`,
      };
    }

    const all = this.getCategories().filter(c => c.id !== id);
    setItem(STORAGE_KEYS.CATEGORIES, all);
    window.dispatchEvent(new Event('quantum_categories_updated'));
    return { success: true };
  },
};
