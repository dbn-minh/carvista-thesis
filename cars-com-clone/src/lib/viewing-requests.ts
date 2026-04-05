import type { ViewingRequest } from "./types";

export type PreferredContactMethod = "phone" | "email" | "phone_or_email";

export type SellerFollowUpStatus =
  | "new"
  | "contacted"
  | "no_answer"
  | "follow_up_needed"
  | "scheduled"
  | "completed"
  | "closed"
  | "cancelled";

export const DEFAULT_VIEWING_REQUEST_MESSAGE =
  "Hi, I'd like to schedule a viewing for this car.";

export const preferredContactOptions: Array<{
  value: PreferredContactMethod;
  label: string;
}> = [
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "phone_or_email", label: "Phone or email" },
];

export const sellerFollowUpStatusOptions: Array<{
  value: Exclude<SellerFollowUpStatus, "cancelled">;
  label: string;
}> = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "no_answer", label: "No answer" },
  { value: "follow_up_needed", label: "Follow-up needed" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
];

const statusLabels: Record<SellerFollowUpStatus, string> = {
  new: "New",
  contacted: "Contacted",
  no_answer: "No answer",
  follow_up_needed: "Follow-up needed",
  scheduled: "Scheduled",
  completed: "Completed",
  closed: "Closed",
  cancelled: "Cancelled",
};

const statusBadgeClasses: Record<SellerFollowUpStatus, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/15 dark:text-blue-100 dark:border-blue-400/20",
  contacted:
    "bg-cyan-50 text-cyan-700 border-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-100 dark:border-cyan-400/20",
  no_answer:
    "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/15 dark:text-amber-100 dark:border-amber-400/20",
  follow_up_needed:
    "bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-500/15 dark:text-orange-100 dark:border-orange-400/20",
  scheduled:
    "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-100 dark:border-emerald-400/20",
  completed:
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-100 dark:border-slate-400/20",
  closed:
    "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-500/15 dark:text-rose-100 dark:border-rose-400/20",
  cancelled:
    "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-200 dark:border-slate-400/20",
};

export function getRequestStatusLabel(status?: string | null) {
  const normalized = String(status || "new") as SellerFollowUpStatus;
  return statusLabels[normalized] || "New";
}

export function getRequestStatusBadgeClass(status?: string | null) {
  const normalized = String(status || "new") as SellerFollowUpStatus;
  return (
    statusBadgeClasses[normalized] ||
    statusBadgeClasses.new
  );
}

export function isActiveViewingRequestStatus(status?: string | null) {
  return !["cancelled", "closed", "completed"].includes(String(status || "new"));
}

export function buildLatestRequestMap(items: ViewingRequest[]) {
  const map = new Map<number, ViewingRequest>();

  for (const item of items) {
    if (!item?.listing_id || map.has(item.listing_id)) continue;
    map.set(item.listing_id, item);
  }

  return map;
}

export function getPreferredContactLabel(
  method?: string | null,
  fallback?: Pick<ViewingRequest, "contact_email" | "contact_phone">
) {
  if (method === "phone") return "Phone";
  if (method === "email") return "Email";
  if (method === "phone_or_email") return "Phone or email";

  const hasPhone = Boolean(fallback?.contact_phone);
  const hasEmail = Boolean(fallback?.contact_email);

  if (hasPhone && hasEmail) return "Phone or email";
  if (hasPhone) return "Phone";
  if (hasEmail) return "Email";
  return "Account details";
}
