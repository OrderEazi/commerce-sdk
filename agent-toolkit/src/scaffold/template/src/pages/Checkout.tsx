import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { checkout, cart as cartApi } from '../lib/api';
import { useCart } from '../contexts/CartContext';
import type { PaymentOption, ShippingProvider } from '../lib/types';

// South Africa - the only country configured for this store today (see CountryId lookup); a real
// multi-country deployment would need a /catalog/countries endpoint, which doesn't exist yet.
const DEFAULT_COUNTRY_ID = 1;

type Step = 1 | 2 | 3 | 4 | 5;

export function Checkout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { cart, refresh } = useCart();

  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [contact, setContact] = useState({ email: '', name: '', phone: '' });
  const [address, setAddress] = useState({
    firstName: '', lastName: '', address1: '', city: '', region: '', postalCode: '', phone: '', email: '',
  });

  const [shippingOptions, setShippingOptions] = useState<ShippingProvider[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingProvider | null>(null);

  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<string>('');

  useEffect(() => {
    checkout.getPaymentOptions().then(setPaymentOptions).catch(() => setPaymentOptions([]));
  }, []);

  if (!cart || cart.items.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-600 mb-6">{t('cart.empty')}</p>
        <button onClick={() => navigate('/products')} className="btn-primary">{t('cart.continueShopping')}</button>
      </div>
    );
  }

  const steps = [t('checkout.step1'), t('checkout.step2'), t('checkout.step3'), t('checkout.step4'), t('checkout.step5')];

  const submitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await checkout.setContactDetails({ Email: contact.email, Name: contact.name, Phone: contact.phone });
      setAddress((a) => ({ ...a, email: contact.email, phone: contact.phone }));
      setStep(2);
    } catch {
      setError(t('common.error') as string);
    } finally {
      setSubmitting(false);
    }
  };

  const submitAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await checkout.setDeliveryAddress({ ...address, countryId: DEFAULT_COUNTRY_ID });
      const options = await checkout.getShippingOptions();
      setShippingOptions(options.providers);
      setStep(3);
    } catch {
      setError(t('common.error') as string);
    } finally {
      setSubmitting(false);
    }
  };

  const submitShipping = async () => {
    if (!selectedShipping) return;
    setSubmitting(true);
    setError(null);
    try {
      await checkout.setShippingOption(
        selectedShipping.systemName,
        selectedShipping.title,
        selectedShipping.quote ?? '0',
        selectedShipping.quoteNumeric ?? 0,
      );
      await refresh();
      setStep(4);
    } catch {
      setError(t('common.error') as string);
    } finally {
      setSubmitting(false);
    }
  };

  const submitPayment = async () => {
    if (!selectedPayment) return;
    setSubmitting(true);
    setError(null);
    try {
      await checkout.setPaymentOption(selectedPayment);
      await refresh();
      setStep(5);
    } catch {
      setError(t('common.error') as string);
    } finally {
      setSubmitting(false);
    }
  };

  const placeOrder = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const freshCart = await cartApi.get();
      if (!freshCart) throw new Error('Cart is empty');
      const returnUrl = `${window.location.origin}/checkout/confirmation`;
      const result = await checkout.createOrder(freshCart.checksum, selectedPayment, returnUrl);
      if (!result.success) {
        setError(result.message || (result.issues ?? []).join(', ') || (t('common.error') as string));
        return;
      }
      if (result.requiresPayment && result.redirectUrl?.startsWith('http')) {
        // An absolute URL is a real third-party gateway's own hosted checkout page (Stripe, PayFast, etc.) -
        // safe to follow directly, no headless-specific handling needed.
        window.location.href = result.redirectUrl;
        return;
      }
      // A relative redirectUrl (e.g. "/payment/terms/process?...") is a built-in payment method's hosted
      // confirmation page - that page only exists in Storefront.StoreApp today, not in this headless API,
      // so there's nowhere for a pure headless client to send the browser. The order itself was created
      // successfully either way; land on the confirmation page and let it note if payment is still pending.
      navigate(
        `/checkout/confirmation?orderRef=${encodeURIComponent(result.orderRef ?? '')}${result.requiresPayment ? '&paymentPending=1' : ''}`,
      );
    } catch {
      setError(t('common.error') as string);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{t('checkout.title')}</h1>

      <div className="flex items-center gap-2 mb-8 text-sm">
        {steps.map((label, idx) => (
          <div key={label} className={`flex items-center gap-2 ${idx + 1 <= step ? 'text-primary-600 font-semibold' : 'text-gray-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${idx + 1 <= step ? 'bg-primary-600 text-white' : 'bg-gray-200'}`}>
              {idx + 1}
            </span>
            {label}
            {idx < steps.length - 1 && <span className="mx-1 text-gray-300">/</span>}
          </div>
        ))}
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {step === 1 && (
        <form onSubmit={submitContact} className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="font-bold text-lg text-gray-900">{t('checkout.contactDetails')}</h2>
          <input required type="email" placeholder={t('checkout.email') as string} value={contact.email}
            onChange={(e) => setContact({ ...contact, email: e.target.value })} className="input-field" />
          <input placeholder="Name" value={contact.name}
            onChange={(e) => setContact({ ...contact, name: e.target.value })} className="input-field" />
          <input placeholder={t('checkout.phone') as string} value={contact.phone}
            onChange={(e) => setContact({ ...contact, phone: e.target.value })} className="input-field" />
          <button disabled={submitting} className="btn-primary w-full">{t('common.continue')}</button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={submitAddress} className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="font-bold text-lg text-gray-900">{t('checkout.deliveryAddress')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <input required placeholder={t('checkout.firstName') as string} value={address.firstName}
              onChange={(e) => setAddress({ ...address, firstName: e.target.value })} className="input-field" />
            <input required placeholder={t('checkout.lastName') as string} value={address.lastName}
              onChange={(e) => setAddress({ ...address, lastName: e.target.value })} className="input-field" />
          </div>
          <input required placeholder={t('checkout.address1') as string} value={address.address1}
            onChange={(e) => setAddress({ ...address, address1: e.target.value })} className="input-field" />
          <div className="grid grid-cols-2 gap-4">
            <input required placeholder={t('checkout.city') as string} value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })} className="input-field" />
            <input required placeholder={t('checkout.region') as string} value={address.region}
              onChange={(e) => setAddress({ ...address, region: e.target.value })} className="input-field" />
          </div>
          <input required placeholder={t('checkout.postalCode') as string} value={address.postalCode}
            onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} className="input-field" />
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="btn-secondary">{t('common.back')}</button>
            <button disabled={submitting} className="btn-primary flex-1">{t('common.continue')}</button>
          </div>
        </form>
      )}

      {step === 3 && (
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="font-bold text-lg text-gray-900">{t('checkout.shippingOptions')}</h2>
          {shippingOptions.length === 0 ? (
            <p className="text-gray-500">{t('checkout.noShippingOptions')}</p>
          ) : (
            <div className="space-y-2">
              {shippingOptions.map((opt) => (
                <label key={opt.systemName} className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer ${selectedShipping?.systemName === opt.systemName ? 'border-primary-600 bg-primary-50' : 'border-gray-200'}`}>
                  <span className="flex items-center gap-3">
                    <input type="radio" checked={selectedShipping?.systemName === opt.systemName}
                      onChange={() => setSelectedShipping(opt)} />
                    {opt.name}
                  </span>
                  <span className="font-medium">{opt.isFreeShipping ? t('common.free') : opt.quote}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(2)} className="btn-secondary">{t('common.back')}</button>
            <button onClick={submitShipping} disabled={submitting || !selectedShipping} className="btn-primary flex-1">
              {t('common.continue')}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="font-bold text-lg text-gray-900">{t('checkout.paymentMethod')}</h2>
          {paymentOptions.length === 0 ? (
            <p className="text-gray-500">{t('checkout.noPaymentOptions')}</p>
          ) : (
            <div className="space-y-2">
              {paymentOptions.map((opt) => (
                <label key={opt.systemName} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${selectedPayment === opt.systemName ? 'border-primary-600 bg-primary-50' : 'border-gray-200'}`}>
                  <input type="radio" checked={selectedPayment === opt.systemName}
                    onChange={() => setSelectedPayment(opt.systemName)} />
                  {opt.displayName}
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(3)} className="btn-secondary">{t('common.back')}</button>
            <button onClick={submitPayment} disabled={submitting || !selectedPayment} className="btn-primary flex-1">
              {t('common.continue')}
            </button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="bg-white rounded-xl shadow p-6 space-y-6">
          <h2 className="font-bold text-lg text-gray-900">{t('checkout.reviewOrder')}</h2>

          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-2">{t('checkout.items')}</h3>
            <ul className="space-y-1 text-sm">
              {cart.items.map((item) => (
                <li key={item.itemId} className="flex justify-between">
                  <span>{item.description} × {item.qty}</span>
                  <span>R{item.total.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-1 text-sm">
            {cart.subTotal != null && <div className="flex justify-between"><span>{t('cart.subtotal')}</span><span>R{cart.subTotal.toFixed(2)}</span></div>}
            {cart.shipping != null && <div className="flex justify-between"><span>{t('cart.shipping')}</span><span>R{cart.shipping.toFixed(2)}</span></div>}
            {cart.tax != null && <div className="flex justify-between"><span>{t('cart.tax')}</span><span>R{cart.tax.toFixed(2)}</span></div>}
            <div className="flex justify-between font-bold text-lg pt-2">
              <span>{t('cart.total')}</span>
              <span>R{(cart.total ?? 0).toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(4)} className="btn-secondary">{t('common.back')}</button>
            <button onClick={placeOrder} disabled={submitting} className="btn-primary flex-1">
              {submitting ? t('checkout.processingOrder') : t('checkout.placeOrder')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
