import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../contexts/CartContext';
import { pictureUrl } from '../lib/pictures';

export function Cart() {
  const { t } = useTranslation();
  const { cart, loading, updateItem, removeItem, clear } = useCart();
  const navigate = useNavigate();

  const handleUpdateQty = async (itemId: number, qty: number) => {
    if (qty <= 0) await removeItem(itemId);
    else await updateItem(itemId, qty);
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('cart.empty')}</h1>
        <p className="text-gray-600 mb-6">{t('cart.emptyDescription')}</p>
        <Link to="/products" className="btn-primary">{t('cart.continueShopping')}</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{t('cart.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {cart.items.map((item) => {
            const image = pictureUrl(item.pictures?.[0]);
            return (
              <div key={item.itemId} className="bg-white rounded-xl shadow p-4 flex gap-4">
                <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {image ? <img src={image} alt={item.description} className="w-full h-full object-contain" /> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{item.description}</h3>
                  <p className="text-sm text-gray-500">{item.sku}</p>
                  <p className="text-sm text-gray-600 mt-1">R{item.price.toFixed(2)} {t('cart.each')}</p>
                </div>
                <div className="flex flex-col items-end justify-between">
                  <button onClick={() => removeItem(item.itemId)} className="text-sm text-red-600 hover:text-red-800">
                    {t('cart.remove')}
                  </button>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={item.qty}
                      onChange={(e) => handleUpdateQty(item.itemId, parseInt(e.target.value, 10) || 0)}
                      className="input-field w-16 py-1 text-center"
                    />
                  </div>
                  <span className="font-semibold text-gray-900">R{item.total.toFixed(2)}</span>
                </div>
              </div>
            );
          })}

          <button onClick={() => clear()} className="text-sm text-gray-500 hover:text-red-600">
            {t('common.delete')} {t('cart.items')}
          </button>
        </div>

        <div className="bg-white rounded-xl shadow p-6 h-fit sticky top-4">
          <h2 className="font-bold text-gray-900 mb-4">{t('cart.estimatedTotal')}</h2>
          <div className="space-y-2 text-sm mb-4">
            {cart.subTotal != null && (
              <div className="flex justify-between"><span className="text-gray-600">{t('cart.subtotal')}</span><span>R{cart.subTotal.toFixed(2)}</span></div>
            )}
            {cart.shipping != null && (
              <div className="flex justify-between"><span className="text-gray-600">{t('cart.shipping')}</span><span>R{cart.shipping.toFixed(2)}</span></div>
            )}
            {cart.tax != null && (
              <div className="flex justify-between"><span className="text-gray-600">{t('cart.tax')}</span><span>R{cart.tax.toFixed(2)}</span></div>
            )}
          </div>
          <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-4 mb-6">
            <span>{t('cart.total')}</span>
            <span>R{(cart.total ?? 0).toFixed(2)}</span>
          </div>
          <button onClick={() => navigate('/checkout')} className="btn-primary w-full">
            {t('cart.checkout')}
          </button>
        </div>
      </div>
    </div>
  );
}
