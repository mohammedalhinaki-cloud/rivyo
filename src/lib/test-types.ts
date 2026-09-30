/** أنواع مشتركة لصفحة اختبار التكامل /admin/google-test */

export type TestStepId =
  | "oauth"
  | "account-access"
  | "business-profile"
  | "locations"
  | "reviews-read"
  | "review-reply"
  | "reply-update"
  | "reply-delete";

export type TestStepStatus = "idle" | "running" | "pass" | "fail" | "skip";

export interface TestStep {
  id: TestStepId;
  title: string;
  status: TestStepStatus;
  summary: string;
  raw?: unknown;
  docs?: string;
}

export interface ReplyTargetReview {
  name: string;
  reviewer: string;
  isAnonymous: boolean;
  rating: number;
  comment: string | null;
  createTime?: string;
  hasReply: boolean;
  replyComment: string | null;
}

export interface ReplyTargetLocation {
  name: string;
  title: string;
  address: string;
}

export interface RunResponse {
  ok: boolean;
  steps: TestStep[];
  replyTarget: {
    accounts: { name: string; accountName: string | null; type: string | null }[];
    locations: ReplyTargetLocation[];
    chosenLocation: string | null;
    reviews: ReplyTargetReview[];
  } | null;
  error?: string;
}

export interface ReplyActionResponse {
  ok: boolean;
  action: string;
  verified?: boolean;
  httpStatus?: number;
  previousReply?: string | null;
  replyNow?: string | null;
  summary?: string;
  raw?: unknown;
  error?: unknown;
}
