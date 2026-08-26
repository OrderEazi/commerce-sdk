import { useEffect, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { orders as ordersApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { OrderModel } from '../lib/types';

export function OrderDetail() {
  const { t } = useTranslation();
  const { isAuth } = useAuth();
  const { id } = useParams();
  const [order, setOrder] = useState<OrderModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuth || !id) return;
    ordersApi.get(parseInt(id, 10)).then(setOrder).catch(() => setOrder(null)).finally(() => setLoading(false));
  }, [isAuth, id]);

  if (!isAuth) return <Navigate to="/login" replace />;

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (!order) {
    return <p className="text-center py-20 text-gray-500">{t('productDetail.notFound')}</p>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/orders" className="text-primary-600 hover:text-primary-700 text-sm mb-4 inline-block">
        ← {t('profile.orderHistory')}
      </Link>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
            <p className="text-sm text-gray-500">{t('profile.placedOn')} {new Date(order.createdDate).toLocaleDateString()}</p>
          </div>
          <span className="badge bg-primary-100 text-primary-800">{order.orderStatus ?? order.status}</span>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="pb-2">Item</th>
              <th className="pb-2 text-center">Qty</th>
              <th className="pb-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(order.orderItems ?? []).map((item, idx) => (
              <tr key={idx} className="border-b border-gray-100">
                <td className="py-2">{item.description}</td>
                <td className="py-2 text-center">{item.qty}</td>
                <td className="py-2 text-right">R{(item.totalNumeric ?? 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-between font-bold text-lg pt-4 mt-4 border-t border-gray-200">
          <span>{t('cart.total')}</span>
          <span>R{(order.orderTotalNumeric ?? 0).toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
