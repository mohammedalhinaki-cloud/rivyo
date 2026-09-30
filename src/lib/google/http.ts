/**
 * طبقة HTTP موحدة لنداءات Google — تصميمها يضمن عدم إخفاء أي خطأ من Google أبدًا:
 * أي استجابة غير ناجحة تُرمى كـ GoogleApiError تحمل نص الاستجابة الخام كاملًا.
 */

export class GoogleApiError extends Error {
  readonly status: number;
  readonly method: string;
  readonly url: string;
  readonly rawBody: string;

  constructor(opts: { status: number; method: string; url: string; rawBody: string }) {
    super(`Google API ${opts.method} ${opts.url} → HTTP ${opts.status}\n${opts.rawBody}`);
    this.name = "GoogleApiError";
    this.status = opts.status;
    this.method = opts.method;
    this.url = opts.url;
    this.rawBody = opts.rawBody;
  }

  /** جسم الاستجابة من Google ككائن JSON إن أمكن (رسالة الخطأ الأصلية) */
  parsedBody(): unknown {
    try {
      return JSON.parse(this.rawBody);
    } catch {
      return null;
    }
  }
}

export async function googleFetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const text = await res.text();
  if (!res.ok) {
    throw new GoogleApiError({
      status: res.status,
      method: init?.method ?? "GET",
      url,
      rawBody: text,
    });
  }
  return (text ? JSON.parse(text) : null) as T;
}

/** تحويل أي خطأ إلى حمولة قابلة للعرض كما هي (رسالة Google الأصلية) */
export function errorToPayload(err: unknown): {
  name: string;
  message: string;
  status?: number;
  method?: string;
  url?: string;
  googleErrorBody?: unknown;
} {
  if (err instanceof GoogleApiError) {
    return {
      name: err.name,
      message: err.message,
      status: err.status,
      method: err.method,
      url: err.url,
      googleErrorBody: err.parsedBody() ?? err.rawBody,
    };
  }
  return { name: err instanceof Error ? err.name : "Error", message: err instanceof Error ? err.message : String(err) };
}
