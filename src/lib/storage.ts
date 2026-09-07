const ASSET_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const MAX_ASSET_BYTES = 2 * 1024 * 1024;

const extensionByType: Record<(typeof ASSET_TYPES)[number], string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const validateCompanyAsset = (file: File): string | null => {
  if (!(ASSET_TYPES as readonly string[]).includes(file.type)) {
    return "Upload a PNG, JPEG, or WebP image.";
  }
  if (file.size > MAX_ASSET_BYTES) {
    return "Image size must be 2 MB or less.";
  }
  return null;
};

export const getCompanyAssetExtension = (file: File): string =>
  extensionByType[file.type as keyof typeof extensionByType];

export const getCompanyAssetPath = (value: string | null): string | null => {
  if (!value) return null;
  const publicMarker = "/storage/v1/object/public/company-assets/";
  const signedMarker = "/storage/v1/object/sign/company-assets/";
  if (value.includes(publicMarker)) return value.split(publicMarker)[1]?.split("?")[0] ?? null;
  if (value.includes(signedMarker)) return value.split(signedMarker)[1]?.split("?")[0] ?? null;
  return value.startsWith("http") ? null : value;
};
