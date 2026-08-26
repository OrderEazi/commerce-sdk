import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { wishlists as wishlistsApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { WishlistDetailModel, WishlistModel } from '../lib/types';

export function Wishlist() {
  const { t } = useTranslation();
  const { isAuth } = useAuth();
  const [wishlists, setWishlists] = useState<WishlistModel[]>([]);
  const [detail, setDetail] = useState<WishlistDetailModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuth) return;
    wishlistsApi
      .list()
      .then(async (list) => {
        setWishlists(list);
        if (list[0]) {
          const full = await wishlistsApi.get(list[0].documentRef);
          setDetail(full);
        }
      })
      .catch(() => setWishlists([]))
      .finally(() => setLoading(false));
  }, [isAuth]);

  if (!isAuth) return <Navigate to="/login" replace />;

  const handleRemove = async (lineId: number) => {
    if (!detail) return;
    setRemovingId(lineId);
    try {
      await wishlistsApi.removeItem(detail.documentId, lineId);
      setDetail({ ...detail, items: detail.items.filter((i) => i.documentLineId !== lineId) });
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (!wishlists.length || !detail || detail.items.length === 0) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('wishlist.empty')}</h1>
        <p className="text-gray-600 mb-6">{t('wishlist.emptyDescription')}</p>
        <Link to="/products" className="btn-primary">{t('cart.continueShopping')}</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{detail.name || t('wishlist.title')}</h1>

      <div className="space-y-4">
        {detail.items.map((item) => (
          <div key={item.documentLineId} className="bg-white rounded-xl shadow p-4 flex gap-4 items-center">
            <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
              {item.pictureUrl ? (
                <img src={item.pictureUrl} alt={item.name} className="w-full h-full object-contain" />
              ) : null}
            </div>
            <div className="flex-1 min-w-0">
              <Link to={`/product/${item.productId}`} className="font-medium text-gray-900 hover:text-primary-600 truncate block">
                {item.name}
              </Link>
              <p className="text-sm text-gray-500">{item.sku}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link to={`/product/${item.productId}`} className="btn-secondary text-sm py-2 px-4">
                {t('productDetail.addToCart')}
              </Link>
              <button
                onClick={() => handleRemove(item.documentLineId)}
                disabled={removingId === item.documentLineId}
                className="text-sm text-red-600 hover:text-red-800"
              >
                {t('cart.remove')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
