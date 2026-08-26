import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { search } from '../lib/api';
import { useStore } from '../contexts/StoreContext';
import { ProductCard } from '../components/ProductCard';
import type { FilterProductModel } from '../lib/types';

function categoryImage(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('//') ? `https:${url}` : url;
}

export function Home() {
  const { t } = useTranslation();
  const { categories } = useStore();
  const [products, setProducts] = useState<FilterProductModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    search
      .getProducts({ limit: 8 })
      .then((r) => setProducts(r.products))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const featuredCategories = categories.slice(0, 6);

  return (
    <div>
      <div className="relative bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl overflow-hidden mb-12 shadow-xl">
        <div className="relative px-8 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">{t('home.welcome', { storeName: 'the store' })}</h1>
          <p className="text-lg md:text-xl text-primary-100 mb-8 max-w-2xl mx-auto">{t('home.heroDescription')}</p>
          <Link
            to="/products"
            className="inline-block bg-white text-primary-600 px-8 py-3 rounded-lg font-bold text-lg hover:bg-gray-100 transition-all shadow-lg"
          >
            {t('home.shopNow')} →
          </Link>
        </div>
      </div>

      {featuredCategories.length > 0 && (
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('products.categories')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {featuredCategories.map((c) => (
              <Link
                key={c.categoryId}
                to={`/category/${c.categoryId}`}
                className="product-card p-4 flex flex-col items-center text-center gap-2"
              >
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                  {categoryImage(c.pictureUrl) ? (
                    <img src={categoryImage(c.pictureUrl)!} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-400 text-xl font-semibold">{c.name[0]}</span>
                  )}
                </div>
                <span className="text-sm font-medium text-gray-700">{c.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">{t('home.featuredProducts')}</h2>
        <Link to="/products" className="text-primary-600 hover:text-primary-700 font-semibold">
          {t('common.viewAll')} →
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : products.length === 0 ? (
        <p className="text-gray-500 text-lg text-center py-20">{t('home.noProducts')}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.productId} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
