"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import StatusBanner from "@/components/common/StatusBanner";
import { authApi } from "@/lib/carvista-api";
import { useRequireLogin } from "@/lib/auth-guard";
import type { User } from "@/lib/types";
import { preferredContactOptions, type PreferredContactMethod } from "@/lib/viewing-requests";

export default function ProfilePage() {
  const ready = useRequireLogin("/profile");
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    preferred_contact_method: "phone_or_email" as PreferredContactMethod,
  });

  useEffect(() => {
    if (!ready) return;

    const loadProfile = async () => {
      setLoading(true);
      try {
        const response = await authApi.me();
        setProfile(response.user);
        setForm({
          name: response.user?.name || "",
          email: response.user?.email || "",
          phone: response.user?.phone || "",
          preferred_contact_method:
            (response.user?.preferred_contact_method as PreferredContactMethod | null) ||
            "phone_or_email",
        });
      } catch (error) {
        setTone("error");
        setMessage(error instanceof Error ? error.message : "Could not load your profile.");
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [ready]);

  if (!ready) return null;

  async function saveProfile() {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setTone("error");
      setMessage("Full name, email, and phone number are required so sellers can contact you.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await authApi.updateMe({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        preferred_contact_method: form.preferred_contact_method,
      });
      setProfile(response.user);
      setTone("success");
      setMessage("Profile updated. CarVista will use these details to prefill your viewing requests.");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not update your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header />
      <main className="container-cars py-8">
        <section className="section-shell overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(233,241,255,0.9))] p-6 md:p-8 dark:bg-[linear-gradient(135deg,rgba(12,18,31,0.96),rgba(23,37,64,0.92))]">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
            Account
          </p>
          <h1 className="mt-2 text-4xl font-apercu-bold text-cars-primary">Profile</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
            Keep your contact details up to date so sellers can reach you when you request a viewing.
          </p>
        </section>

        <div className="mt-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        <section className="section-shell mt-6 p-6 md:p-7">
          {loading ? (
            <p className="text-sm text-cars-gray">Loading your profile...</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="grid gap-3">
                <label className="text-sm font-semibold text-cars-primary">Full name</label>
                <input
                  className="h-12 rounded-[20px] border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-background"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Your full name"
                />

                <label className="mt-2 text-sm font-semibold text-cars-primary">Email</label>
                <input
                  className="h-12 rounded-[20px] border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-background"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="Email address"
                />

                <label className="mt-2 text-sm font-semibold text-cars-primary">Phone number</label>
                <input
                  className="h-12 rounded-[20px] border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-background"
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, phone: event.target.value }))
                  }
                  placeholder="Phone number"
                />

                <label className="mt-2 text-sm font-semibold text-cars-primary">
                  Preferred contact method
                </label>
                <select
                  className="h-12 rounded-[20px] border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-background"
                  value={form.preferred_contact_method}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      preferred_contact_method: event.target.value as PreferredContactMethod,
                    }))
                  }
                >
                  {preferredContactOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => void saveProfile()}
                    disabled={saving}
                    className="rounded-full bg-cars-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cars-accent disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {saving ? "Saving..." : "Save profile"}
                  </button>
                </div>
              </div>

              <aside className="rounded-[28px] bg-cars-off-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                  Used in requests
                </p>
                <h2 className="mt-2 text-2xl font-apercu-bold text-cars-primary">
                  Ready for sellers
                </h2>
                <p className="mt-3 text-sm leading-6 text-cars-gray">
                  When your email and phone number are saved here, CarVista can prefill viewing requests and avoid repetitive popups.
                </p>

                <dl className="mt-5 space-y-3 text-sm">
                  <div className="rounded-[20px] bg-white/80 px-4 py-3 dark:bg-background/80">
                    <dt className="font-medium text-cars-primary">Current email</dt>
                    <dd className="mt-1 text-cars-gray">{profile?.email || "Missing"}</dd>
                  </div>
                  <div className="rounded-[20px] bg-white/80 px-4 py-3 dark:bg-background/80">
                    <dt className="font-medium text-cars-primary">Current phone</dt>
                    <dd className="mt-1 text-cars-gray">{profile?.phone || "Missing"}</dd>
                  </div>
                  <div className="rounded-[20px] bg-white/80 px-4 py-3 dark:bg-background/80">
                    <dt className="font-medium text-cars-primary">Preferred contact</dt>
                    <dd className="mt-1 text-cars-gray">
                      {preferredContactOptions.find(
                        (option) =>
                          option.value ===
                          ((profile?.preferred_contact_method as PreferredContactMethod | null) ||
                            form.preferred_contact_method)
                      )?.label || "Phone or email"}
                    </dd>
                  </div>
                </dl>
              </aside>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
