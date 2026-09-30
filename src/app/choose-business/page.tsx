import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAppConfig } from "@/lib/config";
import { getValidGoogleAccessToken } from "@/lib/google/connection";
import { errorToPayload } from "@/lib/google/http";
import {
  listGoogleAccounts,
  listGoogleLocations,
  locationAddressLine,
  type GbpAccount,
  type GbpLocation,
} from "@/lib/google/business-profile";
import { ApiErrorCard, ReconnectCard, SetupNotice } from "@/components/state-cards";
import { LocationPicker } from "./location-picker";
import { MaaounBadge, RivyoMark, SiteFooter } from "@/components/brand";

export const dynamic = "force-dynamic";

export interface PickerGroup {
  accountName: string;
  accountType: string;
  locations: { name: string; title: string; address: string }[];
  errorPayload?: unknown;
}

export default async function ChooseBusinessPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const cfg = getAppConfig();

  const header = (
    <div className="mb-8 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <RivyoMark />
        <span className="text-xl font-extrabold">Rivyo</span>
      </div>
      <MaaounBadge />
    </div>
  );

  if (cfg.missingCore.length > 0) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {header}
        <SetupNotice missing={cfg.missingCore} />
      </main>
    );
  }

  const token = await getValidGoogleAccessToken(user.id);
  if (!token.ok) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {header}
        <ReconnectCard message={token.error} raw={token.errorPayload} />
      </main>
    );
  }

  // جلب الحسابات والمواقع الحقيقية من Google — مع إظهار أي خطأ أصلي كما هو
  let accounts: GbpAccount[] = [];
  try {
    accounts = await listGoogleAccounts(token.accessToken);
  } catch (err) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {header}
        <ApiErrorCard
          title="فشل جلب حسابات Google"
          message="تأكد من تفعيل My Business APIs في مشروع Google Cloud ومن منح مشروعك وصول Business Profile APIs. رسالة Google الأصلية بالأسفل."
          raw={errorToPayload(err)}
          docs="https://developers.google.com/my-business/content/prereqs"
        />
      </main>
    );
  }

  const groups: PickerGroup[] = [];
  for (const account of accounts.slice(0, 10)) {
    try {
      const locs: GbpLocation[] = await listGoogleLocations(token.accessToken, account.name);
      groups.push({
        accountName: account.accountName ?? account.name,
        accountType: account.type ?? "",
        locations: locs.map((l) => ({
          name: l.name,
          title: l.locationName ?? l.name,
          address: locationAddressLine(l),
        })),
      });
    } catch (err) {
      groups.push({
        accountName: account.accountName ?? account.name,
        accountType: account.type ?? "",
        locations: [],
        errorPayload: errorToPayload(err),
      });
    }
  }

  return (
    <>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {header}
        <h1 className="text-2xl font-extrabold">اختر نشاطك التجاري</h1>
        <p className="mt-1 text-sm text-black/60">
          هذه قائمة حقيقية بالأنشطة المرتبطة بحساب Google الذي ربطته ({user.email}).
        </p>
        <LocationPicker groups={groups} />
      </main>
      <SiteFooter />
    </>
  );
}
