import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { orders as ordersApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { OrderModel } from '../lib/types';

export function Orders() {
  const { t } = useTranslation();
  const { isAuth } = useAuth();
  const [orders, setOrders] = useState<OrderModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuth) return;
    ordersApi.list().then(setOrders).catch(() => setOrders([])).finally(() => setLoading(false));
  }, [isAuth]);

  if (!isAuth) return <Navigate to="/login" replace />;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('profile.title')}</h1>

      <div className="flex gap-4 mb-8">
        <Link to="/profile" className="font-semibold text-gray-500 hover:text-primary-600 pb-2">
          {t('profile.profileDetails')}
        </Link>
        <Link to="/orders" className="font-semibold text-primary-600 border-b-2 border-primary-600 pb-2">
          {t('profile.orderHistory')}
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : orders.length === 0 ? (
        <p className="text-gray-500 py-12 text-center">{t('profile.noOrders')}</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.orderId}
              to={`/orders/${order.orderId}`}
              className="block bg-white rounded-xl shadow p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-gray-900">{order.orderNumber}</p>
                  <p className="text-sm text-gray-500">{new Date(order.createdDate).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">R{(order.orderTotalNumeric ?? 0).toFixed(2)}</p>
                  <p className="text-xs text-gray-500">{order.orderStatus ?? order.status}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
