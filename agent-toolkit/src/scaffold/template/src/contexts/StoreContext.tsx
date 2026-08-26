import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { catalog } from '../lib/api';
import type { Category, Menu } from '../lib/types';

interface StoreContextType {
  categories: Category[];
  mainMenu: Menu | null;
  footerMenu: Menu | null;
  loading: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within a StoreProvider');
  return context;
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [mainMenu, setMainMenu] = useState<Menu | null>(null);
  const [footerMenu, setFooterMenu] = useState<Menu | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      catalog.getCategories().catch(() => []),
      catalog.getMenu('main').catch(() => null),
      catalog.getMenu('footer').catch(() => null),
    ]).then(([cats, menu, footer]) => {
      setCategories(cats);
      setMainMenu(menu);
      setFooterMenu(footer);
      setLoading(false);
    });
  }, []);

  return (
    <StoreContext.Provider value={{ categories, mainMenu, footerMenu, loading }}>{children}</StoreContext.Provider>
  );
}
