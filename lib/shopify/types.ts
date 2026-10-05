export type ShopifyMoney = { amount: string; currencyCode: string };

export type ShopifyImage = { url: string; altText: string | null; width: number | null; height: number | null };

export type ShopifyVideoSource = { url: string; mimeType: string; format: string; height: number };

/** One entry of a product's media, in the order the merchant arranged it in Shopify. */
export type ShopifyMedia = {
  mediaContentType: 'IMAGE' | 'VIDEO' | 'EXTERNAL_VIDEO' | 'MODEL_3D';
  alt: string | null;
  previewImage: ShopifyImage | null;
  image?: ShopifyImage | null;
  sources?: ShopifyVideoSource[];
  embedUrl?: string;
  host?: 'YOUTUBE' | 'VIMEO';
};

export type ShopifyVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: ShopifyMoney;
  compareAtPrice: ShopifyMoney | null;
  selectedOptions: { name: string; value: string }[];
};

export type ShopifyProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  availableForSale: boolean;
  tags: string[];
  featuredImage: ShopifyImage | null;
  images: { nodes: ShopifyImage[] };
  media: { nodes: ShopifyMedia[] };
  variants: { nodes: ShopifyVariant[] };
  priceRange: { minVariantPrice: ShopifyMoney };
};

export type ShopifyCartLine = {
  id: string;
  quantity: number;
  cost: { amountPerQuantity: ShopifyMoney; totalAmount: ShopifyMoney };
  merchandise: {
    id: string;
    title: string;
    availableForSale: boolean;
    price: ShopifyMoney;
    image: ShopifyImage | null;
    product: { id: string; handle: string; title: string };
  };
};

export type ShopifyCart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    subtotalAmount: ShopifyMoney;
    totalAmount: ShopifyMoney;
    totalTaxAmount: ShopifyMoney | null;
  };
  lines: { nodes: ShopifyCartLine[] };
};

export type ShopifyUserError = { field: string[] | null; message: string };

/** Normalised cart the client renders, in either Shopify or local-fallback mode. */
export type CartState = {
  /** False when Shopify credentials are absent — the UI falls back to a local bag. */
  connected: boolean;
  id: string | null;
  checkoutUrl: string | null;
  currencyCode: string;
  subtotal: number;
  totalQuantity: number;
  lines: CartStateLine[];
};

export type CartStateLine = {
  /** Shopify cart line id. Null in local-fallback mode. */
  id: string | null;
  /** Local catalogue product id, resolved from the Shopify handle where possible. */
  productId: string;
  variantId: string | null;
  handle: string | null;
  title: string;
  /**
   * The line's own photo, straight from Shopify, and what the bag shows. The
   * bundled record is only the fallback, for a local bag built while Shopify
   * is unreachable; a product the site has no bundled record for — anything
   * added to the store later — still shows its real picture either way.
   */
  image: string | null;
  quantity: number;
  unitPrice: number;
  currencyCode: string;
};
