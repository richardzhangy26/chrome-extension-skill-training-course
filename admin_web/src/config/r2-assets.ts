const R2_ASSET_BASE_URL = 'https://pub-54f2388ff285445098f9e7ffeb7be9ea.r2.dev';

const getR2AssetUrl = (path: string) => `${R2_ASSET_BASE_URL}/${path.replace(/^\/+/, '')}`;

export { getR2AssetUrl, R2_ASSET_BASE_URL };
