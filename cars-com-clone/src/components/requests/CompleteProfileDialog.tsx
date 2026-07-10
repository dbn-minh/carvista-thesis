"use client";

import { useEffect, useState } from "react";
import StatusBanner from "@/components/common/StatusBanner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authApi } from "@/lib/carvista-api";
import {
  hasVietnamPhoneSubscriberDigits,
  normalizeVietnamPhoneInput,
  VIETNAM_PHONE_PREFIX,
} from "@/lib/phone";
import type { User } from "@/lib/types";
import {
  preferredContactOptions,
  type PreferredContactMethod,
} from "@/lib/viewing-requests";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProfile?: Partial<User> | null;
  title?: string;
  description?: string;
  submitLabel?: string;
  onSaved: (user: User) => void | Promise<void>;
};

type DraftState = {
  name: string;
  email: string;
  phone: string;
  preferred_contact_method: PreferredContactMethod;
};

function buildDraft(initialProfile?: Partial<User> | null): DraftState {
  return {
    name: initialProfile?.name || "",
    email: initialProfile?.email || "",
    phone: initialProfile?.phone || VIETNAM_PHONE_PREFIX,
    preferred_contact_method:
      (initialProfile?.preferred_contact_method as PreferredContactMethod | null) ||
      "phone_or_email",
  };
}

export default function CompleteProfileDialog({
  open,
  onOpenChange,
  initialProfile,
  title = "Complete your contact details",
  description = "Add your email address and phone number once so sellers can follow up on your viewing requests.",
  submitLabel = "Save and continue",
  onSaved,
}: Props) {
  const [draft, setDraft] = useState<DraftState>(() => buildDraft(initialProfile));
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(buildDraft(initialProfile));
      setMessage("");
      setTone("info");
    }
  }, [open, initialProfile]);

  async function handleSave() {
    const normalizedPhone = normalizeVietnamPhoneInput(draft.phone);

    if (!draft.name.trim() || !draft.email.trim() || !normalizedPhone) {
      setTone("error");
      setMessage("Name, email, and phone number are required before sending a viewing request.");
      return;
    }

    if (!hasVietnamPhoneSubscriberDigits(normalizedPhone)) {
      setTone("error");
      setMessage("Enter a valid Vietnam phone number, for example +84901234567.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await authApi.updateMe({
        name: draft.name.trim(),
        email: draft.email.trim(),
        phone: normalizedPhone,
        preferred_contact_method: draft.preferred_contact_method,
      });
      await onSaved(response.user);
      onOpenChange(false);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not save your profile details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-xl rounded-[28px] border-cars-gray-light/80 bg-background p-0 shadow-[0_28px_70px_rgba(15,45,98,0.18)]">
        <div className="p-5 sm:p-7">
          <DialogHeader>
            <DialogTitle className="text-xl font-apercu-bold text-cars-primary sm:text-2xl">
              {title}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-6 text-cars-gray">
              {description}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5">
            <StatusBanner tone={tone}>{message}</StatusBanner>
          </div>

          <div className="mt-5 grid gap-3">
            <input
              className="h-12 rounded-[20px] border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-background"
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Full name"
            />
            <input
              className="h-12 rounded-[20px] border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-background"
              value={draft.email}
              onChange={(event) =>
                setDraft((current) => ({ ...current, email: event.target.value }))
              }
              placeholder="Email address"
              inputMode="email"
            />
            <input
              className="h-12 rounded-[20px] border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-background"
              value={draft.phone}
              onBlur={() =>
                setDraft((current) => ({
                  ...current,
                  phone:
                    normalizeVietnamPhoneInput(current.phone) ||
                    VIETNAM_PHONE_PREFIX,
                }))
              }
              onChange={(event) =>
                setDraft((current) => ({ ...current, phone: event.target.value }))
              }
              placeholder="+84..."
              inputMode="tel"
              type="tel"
            />
            <select
              className="h-12 rounded-[20px] border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-background"
              value={draft.preferred_contact_method}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  preferred_contact_method: event.target.value as PreferredContactMethod,
                }))
              }
            >
              {preferredContactOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  Preferred contact: {option.label}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter className="mt-6 grid gap-2 sm:flex sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-cars-primary/15 px-4 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white sm:w-auto"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-cars-primary px-5 text-sm font-semibold text-white transition hover:bg-cars-accent disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            >
              {saving ? "Saving..." : submitLabel}
            </button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
