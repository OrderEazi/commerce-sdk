import type { Picture } from './types';

// Different endpoints shape a picture differently: catalog/search/product-detail models use
// path/altText, cart line items use url/alt. Handle both so callers don't have to know which shape
// they're holding.
export function pictureUrl(picture: Picture | null | undefined): string | null {
  const raw = picture?.path ?? picture?.url;
  if (!raw) return null;
  return raw.startsWith('//') ? `https:${raw}` : raw;
}

export function pictureAlt(picture: Picture | null | undefined): string {
  return picture?.altText ?? picture?.alt ?? '';
}

// Product detail returns one entry per underlying photo PER use-type/size (default, list, thumbnail,
// detailCarouselMain, openGraphImage, ...) - e.g. one real photo becomes ~13 near-identical entries.
// Collapse to one representative entry per unique source image (matched by path with its size/crop
// query string stripped), preferring the largest/most detail-oriented variant for gallery display.
const PREFERRED_USE_TYPES = ['detailCarouselMain', 'large', 'standard', 'default'];

export function dedupePictures(pictures: Picture[] | null | undefined): Picture[] {
  if (!pictures?.length) return [];

  const groups = new Map<string, Picture[]>();
  for (const picture of pictures) {
    const base = (picture.path ?? picture.url ?? '').split('?')[0];
    if (!base) continue;
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base)!.push(picture);
  }

  return Array.from(groups.values()).map((group) => {
    for (const useType of PREFERRED_USE_TYPES) {
      const match = group.find((p) => (p as { pictureUseType?: string }).pictureUseType === useType);
      if (match) return match;
    }
    return group[0];
  });
}
