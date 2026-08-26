import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { payments } from '../lib/api';
import { useCart } from '../contexts/CartContext';

export function CheckoutConfirmation() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const orderRef = searchParams.get('orderRef');
  const paymentPending = searchParams.get('paymentPending') === '1';
  const { refresh } = useCart();

  const [status, setStatus] = useState<{ orderStatus: string; paymentStatus: string; paid: boolean } | null>(null);

  useEffect(() => {
    // The order consumed the cart server-side - refresh so the header's item count stops showing the
    // now-checked-out items.
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!orderRef) return;
    payments.getStatus(orderRef).then(setStatus).catch(() => setStatus(null));
  }, [orderRef]);

  return (
    <div className="max-w-lg mx-auto text-center py-12">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('checkoutSuccess.title')}</h1>
      <p className="text-gray-600 mb-6">{t('checkoutSuccess.confirmationMessage')}</p>

      {paymentPending && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 mb-6 text-sm text-left">
          This payment method normally finishes on a hosted confirmation page that isn't available in this
          headless environment yet. Your order has been placed - check the order's status below or in your
          order history.
        </div>
      )}

      {orderRef && (
        <div className="bg-white rounded-xl shadow p-6 mb-8 text-left">
          <div className="flex justify-between mb-2">
            <span className="text-gray-500">{t('checkoutSuccess.orderNumber')}</span>
            <span className="font-semibold">{orderRef}</span>
          </div>
          {status && (
            <>
              <div className="flex justify-between mb-2">
                <span className="text-gray-500">{t('cart.title')} {t('common.total')}</span>
                <span className="font-semibold">{status.orderStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('checkout.paymentMethod')}</span>
                <span className="font-semibold">{status.paymentStatus}</span>
              </div>
            </>
          )}
        </div>
      )}

      <Link to="/products" className="btn-primary">{t('checkoutSuccess.continueShopping')}</Link>
    </div>
  );
}
