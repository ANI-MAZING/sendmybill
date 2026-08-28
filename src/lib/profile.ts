import { supabase } from "@/integrations/supabase/client";
import { getCompanyAssetPath } from "@/lib/storage";
import type { ProfileData, SellerSnapshot } from "@/types/domain";

type ProfileSource = Partial<Record<keyof SellerSnapshot, string | null>>;

export const toSellerSnapshot = (profile: ProfileSource): SellerSnapshot => ({
  company_name: profile.company_name ?? "",
  company_address: profile.company_address ?? "",
  company_phone: profile.company_phone ?? "",
  company_email: profile.company_email ?? "",
  tax_id: profile.tax_id ?? "",
  bank_name: profile.bank_name ?? "",
  bank_account_number: profile.bank_account_number ?? "",
  bank_routing_number: profile.bank_routing_number ?? "",
  bank_swift_code: profile.bank_swift_code ?? "",
  company_logo_url: profile.company_logo_url ?? null,
  signature_url: profile.signature_url ?? null,
});

const resolveAssetUrl = async (value: string | null): Promise<string | null> => {
  if (!value || value.startsWith("http")) return value;
  const path = getCompanyAssetPath(value);
  if (!path) return null;
  const { data, error } = await supabase.storage.from("company-assets").createSignedUrl(path, 60 * 60);
  return error ? null : data.signedUrl;
};

export const resolveSellerAssetUrls = async (profile: SellerSnapshot): Promise<ProfileData> => {
  const [companyLogoUrl, signatureUrl] = await Promise.all([
    resolveAssetUrl(profile.company_logo_url),
    resolveAssetUrl(profile.signature_url),
  ]);
  return {
    ...profile,
    company_logo_url: companyLogoUrl,
    signature_url: signatureUrl,
  };
};
