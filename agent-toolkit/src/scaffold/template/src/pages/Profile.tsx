import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { profile as profileApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { ProfileModel } from '../lib/types';

export function Profile() {
  const { t } = useTranslation();
  const { isAuth, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileModel | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', mobile: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuth) return;
    profileApi
      .get()
      .then((p) => {
        setProfile(p);
        setForm({ firstName: p.firstName, lastName: p.lastName, phone: p.phone ?? '', mobile: p.mobile ?? '' });
      })
      .finally(() => setLoading(false));
  }, [isAuth]);

  if (!isAuth) return <Navigate to="/login" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await profileApi.update(form);
      setMessage(t('profile.profileUpdated') as string);
    } catch {
      setMessage(t('common.error') as string);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('profile.title')}</h1>
      <p className="text-gray-600 mb-8">{t('profile.manageAccount')}</p>

      <div className="flex gap-4 mb-8">
        <Link to="/profile" className="font-semibold text-primary-600 border-b-2 border-primary-600 pb-2">
          {t('profile.profileDetails')}
        </Link>
        <Link to="/orders" className="font-semibold text-gray-500 hover:text-primary-600 pb-2">
          {t('profile.orderHistory')}
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-bold text-gray-900">{t('profile.personalInformation')}</h2>
        <div className="grid grid-cols-2 gap-4">
          <input placeholder={t('auth.firstName') as string} value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input-field" />
          <input placeholder={t('auth.lastName') as string} value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input-field" />
        </div>
        <input disabled value={profile?.email ?? ''} className="input-field bg-gray-50 text-gray-500" />
        <div className="grid grid-cols-2 gap-4">
          <input placeholder={t('auth.phone') as string} value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" />
          <input placeholder={t('profile.mobile') as string} value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value })} className="input-field" />
        </div>
        {message && <p className="text-sm text-green-700">{message}</p>}
        <div className="flex justify-between items-center pt-2">
          <button type="button" onClick={logout} className="text-red-600 hover:text-red-800 text-sm font-medium">
            {t('common.logout')}
          </button>
          <button disabled={saving} className="btn-primary">
            {saving ? t('profile.updating') : t('profile.updateProfile')}
          </button>
        </div>
      </form>
    </div>
  );
}
