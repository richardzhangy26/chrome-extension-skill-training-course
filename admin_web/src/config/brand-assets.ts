const BRAND_ASSET_VERSION = '20260621';

const getBrandAssetUrl = (path: string) => `/${path.replace(/^\/+/, '')}?v=${BRAND_ASSET_VERSION}`;

export { BRAND_ASSET_VERSION, getBrandAssetUrl };
