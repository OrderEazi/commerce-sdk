import React from 'react';
import { useTranslation } from 'react-i18next';

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
];

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
      {languages.map((lang) => {
        const isActive = i18n.language === lang.code || i18n.language.startsWith(lang.code);
        return (
          <button
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200
              ${isActive
                ? 'bg-primary-600 text-white shadow-md'
                : 'text-gray-700 hover:bg-gray-100'
              }
            `}
            aria-label={`Switch to ${lang.name}`}
            title={lang.name}
          >
            <span className="text-lg leading-none" role="img" aria-label={lang.name}>
              {lang.flag}
            </span>
            <span className="hidden sm:inline">{lang.code.toUpperCase()}</span>
          </button>
        );
      })}
    </div>
  );
};

