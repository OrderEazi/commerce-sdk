// Shapes returned by Storefront.Api's /api/v1/store/** endpoints.
// Only the fields the app actually renders are typed precisely; anything else is left loose.

export interface Picture {
  path?: string;
  url?: string;
  altText?: string;
  alt?: string;
  // Product detail only: the same photo repeats once per size/context variant (list, thumbnail,
  // detailCarouselMain, openGraphImage, ...) - see dedupePictures in lib/pictures.ts.
  pictureUseType?: string;
  isCoverImage?: boolean;
}

export interface Category {
  categoryId: number;
  name: string;
  path: string;
  parentCategoryId: number | null;
  nestedLevel: number;
  displayOrder: number;
  totalProducts: number;
  pictureUrl: string | null;
  description: string | null;
  children: Category[] | null;
}

export interface MenuItem {
  text: string;
  type: string;
  url: string;
  sitemapUrl?: string;
  displayOrder: number;
  children?: MenuItem[];
}

export interface Menu {
  name: string;
  handle: string;
  items: MenuItem[];
}

// price/priceIncl/priceExcl (and their oldPrice* counterparts) are pre-formatted display strings
// (e.g. "R758,98", store-currency-aware) - the *Numeric siblings carry the raw decimal value.
export interface ProductPrice {
  priceNumeric?: number;
  price?: string;
  priceInclNumeric?: number;
  priceIncl?: string;
  priceExclNumeric?: number;
  priceExcl?: string;
  hasOldPrice?: boolean;
  oldPriceNumeric?: number;
  oldPriceIncl?: string;
  oldPriceExcl?: string;
  [key: string]: unknown;
}

// The API normalizes these list-endpoint keys (search/products, compare, recently-viewed, trending) to
// productId/skuCode server-side so they match ProductModel's single-product shape - see
// JsonFieldSelector.ProductFieldAliases in Storefront.Api.
export interface FilterProductModel {
  productId: number;
  name: string;
  shortName?: string | null;
  shortDescription?: string | null;
  skuCode: string;
  url: string;
  manufacturer?: string | null;
  manufacturerImage?: string | null;
  isEnquiry: boolean;
  pictures: Picture[];
  pricing?: ProductPrice;
  inventory?: { inStock?: boolean; [key: string]: unknown };
  badges?: unknown[];
}

export interface FacetProductResponse {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasLoadMore: boolean;
  sortBy: string;
  products: FilterProductModel[];
  facets?: unknown;
  searchDegraded?: boolean;
  message?: string | null;
}

export interface ProductModel {
  productId: number;
  productType?: string;
  name: string;
  shortName?: string | null;
  skuCode: string;
  barcode?: string | null;
  shortDescription?: string | null;
  fullDescription?: string | null;
  url: string;
  manufacturer?: { name?: string } | null;
  categories?: { categoryId: number; name: string }[];
  pictures: Picture[];
  hasVariants?: boolean;
  variants?: ProductModel[];
  segments?: string;
  segmentValue?: string;
  pricing?: ProductPrice;
  inventory?: { inStock?: boolean; quantity?: number; [key: string]: unknown };
  currencySymbol?: string;
}

export interface CartPhysicalProperties {
  weightGrams?: number;
  heightCentimeters?: number;
  widthCentimeters?: number;
  depthCentimeters?: number;
}

export interface CartItem {
  itemId: number;
  productId: number;
  sku: string;
  type: string;
  itemType: string;
  description: string;
  qty: number;
  price: number;
  discount?: number;
  subTotal: number;
  total: number;
  url?: string;
  specialInstructions?: string | null;
  physicalProperties?: CartPhysicalProperties;
  pictures?: Picture[];
  isEnquiryProduct?: boolean;
  hasTieredPricing?: boolean;
  saveForLaterEnabled?: boolean;
  freeShipping?: boolean;
}

export interface CartModel {
  cartId: string;
  currency: string;
  subTotal?: number;
  discount?: number;
  shipping?: number;
  tax?: number;
  total?: number;
  giftCardPayment?: number;
  walletPayment?: number;
  totalDue?: number;
  paymentRequired: boolean;
  itemCount: number;
  cartWeightGrams: number;
  requiresShipping: boolean;
  allowCollection: boolean;
  allowDelivery: boolean;
  allowWallet: boolean;
  items: CartItem[];
  fulfillmentTableRows?: unknown[];
  notes?: { id: number; message: string }[];
  promocode?: string | null;
  giftCard?: string | null;
  checksum: string;
}

export interface AddToCartResponse {
  success: boolean;
  // Only present when success is true.
  cartReference?: string;
  documentLineId?: number;
  checksum?: string;
  cart?: CartModel;
  // Only present when success is false (e.g. below minimum order quantity, no price configured).
  message?: string;
  warnings?: { code: string; message: string }[];
}

export interface LoginResponse {
  token: string;
  expiresIn: number;
  sessionReference: string;
  refreshToken: string;
  user: {
    id: number;
    email: string;
    personId?: number;
    accountId?: number;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  title?: string;
  phone?: string;
  mobile?: string;
  accountType?: 'Individual' | 'Corporate';
}

export interface DeliveryAddress {
  addressId: number;
  label?: string;
  address1: string;
  address2?: string;
  address3?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  firstName: string;
  lastName: string;
  company?: string;
  vatNr?: string;
  phone: string;
  email: string;
}

export interface ShippingProvider {
  systemName: string;
  name: string;
  title: string;
  slug: string;
  isThirdParty: boolean;
  isFreeShipping?: boolean;
  quote?: string;
  quoteNumeric?: number;
}

export interface ShippingOptionsResponse {
  shippingAvailable: boolean;
  message: string | null;
  providers: ShippingProvider[];
  settings?: unknown;
}

export interface PaymentOption {
  formUrl: string | null;
  systemName: string;
  displayName: string;
  thumbnailType: string;
  isThirdParty: boolean;
}

export interface CreateOrderResponse {
  success: boolean;
  orderRef?: string;
  requiresPayment?: boolean;
  redirectUrl?: string | null;
  message?: string | null;
  issues?: unknown[];
}

export interface OrderModel {
  orderId: number;
  createdDate: string;
  orderRef: string;
  orderNumber: string;
  orderTotalNumeric?: number;
  orderStatus?: string;
  status?: string;
  paymentStatus?: string;
  shippingStatus?: string;
  paymentMethodName?: string;
  shippingMethodName?: string;
  mayCancel?: boolean;
  mayPay?: boolean;
  shippingAddress?: DeliveryAddress;
  billingAddress?: DeliveryAddress;
  orderItems?: {
    productId: number;
    description: string;
    sku?: string;
    qty: number;
    priceNumeric?: number;
    totalNumeric?: number;
  }[];
}

export interface ProfileModel {
  personId: number;
  accountId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  mobile?: string;
  accountName?: string;
  accountType?: string;
}

export interface WishlistModel {
  documentId: number;
  documentRef: string;
  createdOn: string;
  reminderDate?: string | null;
  owner?: string;
  name: string;
  occasion?: string | null;
  itemCount: number;
}

export interface WishlistItemModel {
  documentLineId: number;
  productId: number;
  name: string;
  sku: string;
  url: string;
  pictureUrl?: string | null;
  qty: number;
}

export interface WishlistDetailModel extends WishlistModel {
  items: WishlistItemModel[];
}
