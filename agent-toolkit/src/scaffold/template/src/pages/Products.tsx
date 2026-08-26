import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { search, catalog } from '../lib/api';
import { useStore } from '../contexts/StoreContext';
import { ProductCard } from '../components/ProductCard';
import type { Category, FacetProductResponse } from '../lib/types';

const SORT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'newest:asc', label: 'Newest' },
  { value: 'name:asc', label: 'Name A-Z' },
  { value: 'name:desc', label: 'Name Z-A' },
  { value: 'price:asc', label: 'Price Low-High' },
  { value: 'price:desc', label: 'Price High-Low' },
];

function findCategory(categories: Category[], id: number): Category | null {
  for (const c of categories) {
    if (c.categoryId === id) return c;
    if (c.children) {
      const found = findCategory(c.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function Products() {
  const { t } = useTranslation();
  const { categoryId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories } = useStore();

  const keywords = searchParams.get('keywords') || '';
  const sort = searchParams.get('sort') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  const [category, setCategory] = useState<Category | null>(null);
  const [response, setResponse] = useState<FacetProductResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (categoryId) {
      const found = findCategory(categories, parseInt(categoryId, 10));
      setCategory(found);
      if (!found && categories.length > 0) {
        catalog.getCategory(parseInt(categoryId, 10)).then(setCategory).catch(() => setCategory(null));
      }
    } else {
      setCategory(null);
    }
  }, [categoryId, categories]);

  useEffect(() => {
    setLoading(true);
    const filters = category ? `Categories:${encodeURIComponent(category.path)}` : undefined;
    search
      .getProducts({ keywords: keywords || undefined, page, limit: 20, sort: sort || undefined, filters })
      .then(setResponse)
      .catch(() => setResponse(null))
      .finally(() => setLoading(false));
  }, [keywords, page, sort, category]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const title = category?.name ?? (keywords ? `"${keywords}"` : t('products.allProducts'));

  return (
    <div className="flex gap-8">
      <aside className="w-56 flex-shrink-0 hidden lg:block">
        <div className="bg-white rounded-xl shadow p-4 sticky top-4">
          <h2 className="font-bold text-gray-900 mb-3">{t('products.categories')}</h2>
          <ul className="space-y-1 text-sm">
            <li>
              <a href="/products" className={`block py-1.5 px-2 rounded ${!categoryId ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
                {t('products.allProducts')}
              </a>
            </li>
            {categories.map((c) => (
              <li key={c.categoryId}>
                <a
                  href={`/category/${c.categoryId}`}
                  className={`block py-1.5 px-2 rounded ${String(c.categoryId) === categoryId ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  {c.name} <span className="text-xs opacity-70">({c.totalProducts})</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
            {response && <p className="text-gray-600 text-sm mt-1">{t('products.showing', { count: response.total })}</p>}
          </div>
          <select value={sort} onChange={(e) => updateParam('sort', e.target.value)} className="input-field w-auto py-2">
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600" />
          </div>
        ) : !response || response.products.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg mb-2">{t('products.noProducts')}</p>
            <p className="text-gray-400 text-sm">{t('products.tryAdjusting')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-6 mb-10">
              {response.products.map((product) => (
                <ProductCard key={product.productId} product={product} />
              ))}
            </div>

            {response.totalPages > 1 && (
              <div className="flex justify-center items-center gap-4">
                <button
                  onClick={() => updateParam('page', String(Math.max(1, page - 1)))}
                  disabled={page <= 1}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {t('common.previous')}
                </button>
                <span className="px-4 py-2 bg-white rounded-lg shadow-sm font-semibold text-gray-700 text-sm">
                  {t('products.page')} {page} {t('profile.of')} {response.totalPages}
                </span>
                <button
                  onClick={() => updateParam('page', String(page + 1))}
                  disabled={!response.hasLoadMore}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {t('common.next')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
