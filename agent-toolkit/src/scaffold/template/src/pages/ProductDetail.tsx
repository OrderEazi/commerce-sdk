import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { products, wishlists } from '../lib/api';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { dedupePictures, pictureAlt, pictureUrl } from '../lib/pictures';
import type { ProductModel } from '../lib/types';

interface SegmentValue {
  name: string;
  value: string;
  metaData?: string;
}

function isHexColor(value?: string): boolean {
  return !!value && /^#[0-9a-f]{3,8}$/i.test(value);
}

export function ProductDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { isAuth } = useAuth();

  const [product, setProduct] = useState<ProductModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [wishlisting, setWishlisting] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistError, setWishlistError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    products
      .getById(parseInt(id, 10))
      .then((p) => {
        setProduct(p);
        // Pre-select the first available value for each segment so a fully-priced variant shows
        // immediately instead of forcing the user to click through every option first.
        const firstVariant = p.variants?.[0] as (ProductModel & { segmentValue?: SegmentValue[] }) | undefined;
        const initial: Record<string, string> = {};
        (firstVariant?.segmentValue ?? []).forEach((sv) => { initial[sv.name] = sv.value; });
        setSelection(initial);
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
    setSelectedImage(0);
    setAdded(false);
    setAddError(null);
  }, [id]);

  // Every variant shares the same set of segment names (e.g. colour, size) - collect each segment's
  // distinct available values from the variant list itself, rather than trusting a separate options field.
  const segmentOptions = useMemo(() => {
    const options = new Map<string, Map<string, string | undefined>>();
    for (const variant of product?.variants ?? []) {
      const segmentValue = (variant as ProductModel & { segmentValue?: SegmentValue[] }).segmentValue ?? [];
      for (const sv of segmentValue) {
        if (!options.has(sv.name)) options.set(sv.name, new Map());
        options.get(sv.name)!.set(sv.value, sv.metaData);
      }
    }
    return options;
  }, [product]);

  const matchedVariant = useMemo(() => {
    if (!product?.hasVariants) return null;
    return (product.variants ?? []).find((variant) => {
      const segmentValue = (variant as ProductModel & { segmentValue?: SegmentValue[] }).segmentValue ?? [];
      return segmentValue.length > 0 && segmentValue.every((sv) => selection[sv.name] === sv.value);
    }) ?? null;
  }, [product, selection]);

  const needsVariantSelection = !!product?.hasVariants;
  const displayProduct = matchedVariant ?? product;

  const handleAddToCart = async () => {
    if (!displayProduct) return;
    setAdding(true);
    setAddError(null);
    setAdded(false);
    try {
      const response = await addItem(displayProduct.productId, qty);
      if (response && response.success === false) {
        setAddError(response.message || (t('productDetail.addToCartError') as string));
        return;
      }
      setAdded(true);
    } catch {
      setAddError(t('productDetail.addToCartError') as string);
    } finally {
      setAdding(false);
    }
  };

  const handleAddToWishlist = async () => {
    if (!displayProduct) return;
    if (!isAuth) {
      navigate('/login');
      return;
    }
    setWishlisting(true);
    setWishlistError(null);
    try {
      const existing = await wishlists.list();
      const wishlistId = existing[0]?.documentId ?? (await wishlists.create()).documentId;
      await wishlists.addItem(wishlistId, displayProduct.productId, 1);
      setWishlisted(true);
    } catch {
      setWishlistError(t('common.error') as string);
    } finally {
      setWishlisting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (!product) {
    return <p className="text-center py-20 text-gray-500 text-lg">{t('productDetail.notFound')}</p>;
  }

  const images = dedupePictures(displayProduct?.pictures?.length ? displayProduct.pictures : product.pictures);
  const mainImage = pictureUrl(images[selectedImage]);
  const price = displayProduct?.pricing?.price;
  const oldPrice = displayProduct?.pricing?.hasOldPrice ? displayProduct.pricing.oldPriceIncl : null;

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
        <div>
          <div className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden mb-4">
            {mainImage ? (
              <img src={mainImage} alt={pictureAlt(images[selectedImage]) || product.name} className="w-full h-full object-contain" />
            ) : (
              <span className="text-gray-400">No image</span>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`w-16 h-16 flex-shrink-0 rounded-lg border-2 overflow-hidden ${idx === selectedImage ? 'border-primary-600' : 'border-gray-200'}`}
                >
                  <img src={pictureUrl(img) ?? undefined} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          {product.manufacturer?.name && <p className="text-sm text-gray-500 mb-1">{product.manufacturer.name}</p>}
          <h1 className="text-3xl font-bold text-gray-900 mb-3">{product.name}</h1>
          <p className="text-sm text-gray-500 mb-4">{t('productDetail.sku')}: {displayProduct?.skuCode ?? product.skuCode}</p>

          <div className="flex items-baseline gap-3 mb-6">
            {price && <span className="price-current text-3xl">{price}</span>}
            {oldPrice && <span className="price-original">{oldPrice}</span>}
            {needsVariantSelection && !matchedVariant && (
              <span className="text-sm text-gray-500">{t('productDetail.selectVariantMessage')}</span>
            )}
          </div>

          {product.shortDescription && <p className="text-gray-600 mb-6">{product.shortDescription}</p>}

          {Array.from(segmentOptions.entries()).map(([segmentName, values]) => (
            <div key={segmentName} className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">{segmentName}</label>
              <div className="flex flex-wrap gap-2">
                {Array.from(values.entries()).map(([value, metaData]) =>
                  isHexColor(metaData) ? (
                    <button
                      key={value}
                      title={value}
                      onClick={() => setSelection((s) => ({ ...s, [segmentName]: value }))}
                      className={`w-8 h-8 rounded-full border-2 ${selection[segmentName] === value ? 'border-primary-600' : 'border-gray-300'}`}
                      style={{ backgroundColor: metaData }}
                    />
                  ) : (
                    <button
                      key={value}
                      onClick={() => setSelection((s) => ({ ...s, [segmentName]: value }))}
                      className={`px-3 py-1.5 rounded-lg border text-sm ${selection[segmentName] === value ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-700'}`}
                    >
                      {value}
                    </button>
                  ),
                )}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-4 mb-4">
            <label className="font-medium text-gray-700">{t('common.quantity')}</label>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="input-field w-24 py-2"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleAddToCart}
              disabled={adding || (needsVariantSelection && !matchedVariant)}
              className="btn-primary w-full sm:w-auto"
            >
              {adding ? t('productDetail.addingToCart') : t('productDetail.addToCart')}
            </button>

            <button
              onClick={handleAddToWishlist}
              disabled={wishlisting || wishlisted}
              title={t('productDetail.addToWishlist') as string}
              className="btn-secondary p-2.5"
            >
              {wishlisted ? '♥' : '♡'}
            </button>
          </div>

          {added && (
            <div className="mt-4 flex items-center gap-3">
              <span className="text-green-700 font-medium">{t('common.success')}!</span>
              <button onClick={() => navigate('/cart')} className="btn-secondary text-sm py-2 px-4">
                {t('cart.title')} →
              </button>
            </div>
          )}
          {addError && <p className="mt-4 text-red-600">{addError}</p>}
          {wishlisted && <p className="mt-2 text-green-700 text-sm">{t('productDetail.addedToWishlist')}</p>}
          {wishlistError && <p className="mt-2 text-red-600 text-sm">{wishlistError}</p>}
        </div>
      </div>

      {product.fullDescription && (
        <div className="border-t border-gray-200 pt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('productDetail.productDescription')}</h2>
          {/* Trusted merchant-authored catalog content (same trust boundary as StoreApp's own @Html.Raw rendering), not user input. */}
          <div className="prose max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: product.fullDescription }} />
        </div>
      )}
    </div>
  );
}
