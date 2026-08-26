import { type ReactNode, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useStore } from '../contexts/StoreContext';
import { LanguageSwitcher } from './LanguageSwitcher';

const SITE_NAME = 'Headless Store';

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user, logout, isAuth } = useAuth();
  const { itemCount } = useCart();
  const { categories, footerMenu } = useStore();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/products?keywords=${encodeURIComponent(searchTerm)}`);
  };

  const topLevelCategories = categories.slice(0, 8);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4 gap-4">
            <Link to="/" className="text-2xl font-bold text-primary-700 whitespace-nowrap">
              {SITE_NAME}
            </Link>

            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md">
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('products.searchPlaceholder') as string}
                className="input-field py-2"
              />
            </form>

            <nav className="flex items-center space-x-4">
              <LanguageSwitcher />

              {isAuth && (
                <Link to="/wishlist" className="text-gray-700 hover:text-primary-600 font-medium hidden sm:inline">
                  {t('wishlist.title')}
                </Link>
              )}

              <Link to="/cart" className="relative text-gray-700 hover:text-primary-600 font-medium">
                <span className="flex items-center gap-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="hidden sm:inline">{t('common.cart')}</span>
                </span>
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {itemCount}
                  </span>
                )}
              </Link>

              {isAuth ? (
                <div className="flex items-center space-x-3">
                  <Link to="/profile" className="text-gray-700 hover:text-primary-600 font-medium text-sm hidden sm:inline">
                    {user?.email}
                  </Link>
                  <button onClick={handleLogout} className="text-gray-600 hover:text-red-600 font-medium text-sm">
                    {t('common.logout')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <Link to="/login" className="text-gray-700 hover:text-primary-600 font-medium">
                    {t('common.login')}
                  </Link>
                  <Link to="/register" className="btn-primary text-sm px-4 py-2">
                    {t('common.signUp')}
                  </Link>
                </div>
              )}
            </nav>
          </div>

          {topLevelCategories.length > 0 && (
            <div className="border-t border-gray-100 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
              <div className="flex items-center gap-6 py-2 text-sm whitespace-nowrap">
                {topLevelCategories.map((c) => (
                  <Link
                    key={c.categoryId}
                    to={`/category/${c.categoryId}`}
                    className="text-gray-600 hover:text-primary-600 font-medium"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">{children}</main>

      <footer className="bg-gray-900 text-gray-300 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-white font-bold text-lg mb-4">{SITE_NAME}</h3>
              <p className="text-sm text-gray-400">{t('footer.aboutDescription')}</p>
            </div>
            {footerMenu?.items?.slice(0, 3).map((item) => (
              <div key={item.text}>
                <h4 className="text-white font-semibold mb-4">{item.text}</h4>
                <ul className="space-y-2 text-sm">
                  {(item.children ?? []).map((child) => (
                    <li key={child.text}>
                      <a href={child.url} className="hover:text-white transition-colors">
                        {child.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div>
              <h4 className="text-white font-semibold mb-4">{t('footer.account')}</h4>
              <ul className="space-y-2 text-sm">
                {isAuth ? (
                  <>
                    <li><Link to="/profile" className="hover:text-white transition-colors">{t('profile.myProfile')}</Link></li>
                    <li><Link to="/orders" className="hover:text-white transition-colors">{t('profile.orderHistory')}</Link></li>
                  </>
                ) : (
                  <>
                    <li><Link to="/login" className="hover:text-white transition-colors">{t('common.login')}</Link></li>
                    <li><Link to="/register" className="hover:text-white transition-colors">{t('common.register')}</Link></li>
                  </>
                )}
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8">
            <p className="text-center text-sm text-gray-400">
              {t('footer.copyright', { year: new Date().getFullYear(), storeName: SITE_NAME })}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
