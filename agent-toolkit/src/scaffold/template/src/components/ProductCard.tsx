import { Link } from 'react-router-dom';
import type { FilterProductModel } from '../lib/types';
import { pictureUrl } from '../lib/pictures';

export function ProductCard({ product }: { product: FilterProductModel }) {
  const image = pictureUrl(product.pictures?.[0]);
  const price = product.pricing?.price;
  const oldPrice = product.pricing?.hasOldPrice ? product.pricing.oldPriceIncl : null;

  return (
    <Link to={`/product/${product.productId}`} className="product-card block h-full flex flex-col">
      <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
        {image ? (
          <img src={image} alt={product.name} className="w-full h-full object-contain" loading="lazy" />
        ) : (
          <span className="text-gray-400 text-sm">No image</span>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        {product.manufacturer && <span className="text-xs text-gray-500 mb-1">{product.manufacturer}</span>}
        <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-2 flex-1">{product.name}</h3>
        <div className="flex items-baseline gap-2">
          {price && <span className="price-current text-lg">{price}</span>}
          {oldPrice && <span className="price-original text-sm">{oldPrice}</span>}
        </div>
      </div>
    </Link>
  );
}
