export interface BrandConfig {
  productName: string;
  tagline: string;
  defaultApiBaseUrl: string;
}

export const BRAND_CONFIG: BrandConfig = {
  productName: "GlobeVPN",
  tagline: "Encrypted Browser Proxy",
  defaultApiBaseUrl: "http://localhost:8000/api",
};
