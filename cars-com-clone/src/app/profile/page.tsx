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
      <main className="container-cars py-6 sm:py-8">
        <section className="section-shell overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(233,241,255,0.9))] p-5 sm:p-6 md:p-8 dark:bg-[linear-gradient(135deg,rgba(12,18,31,0.96),rgba(23,37,64,0.92))]">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
            Account
          </p>
          <h1 className="mt-2 text-3xl font-apercu-bold text-cars-primary sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
            Profile
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
            Keep your contact details up to date so sellers can reach you when you request a
            viewing.
          </p>
        </section>

        <div className="mt-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        <section className="section-shell mt-6 p-4 sm:p-5 md:p-6">
          {loading ? (
            <p className="rounded-[22px] bg-cars-off-white/80 px-4 py-4 text-sm text-cars-gray dark:bg-background/70">
              Loading your profile...
            </p>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
              <div className="rounded-[26px] border border-cars-gray-light/70 bg-white p-4 shadow-[0_18px_40px_rgba(15,45,98,0.06)] sm:p-5">
                <div className="mb-5 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                    Contact details
                  </p>
                  <p className="mt-2 text-sm leading-6 text-cars-gray">
                    These details are reused when you contact sellers or send a viewing request.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-semibold text-cars-primary sm:col-span-2">
                    Full name
                    <input
                      className="h-12 w-full rounded-[20px] border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-background"
                      value={form.name}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="Your full name"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-semibold text-cars-primary">
                    Email
                    <input
                      className="h-12 w-full rounded-[20px] border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-background"
                      value={form.email}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, email: event.target.value }))
                      }
                      placeholder="Email address"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-semibold text-cars-primary">
                    Phone number
                    <input
                      className="h-12 w-full rounded-[20px] border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-background"
                      value={form.phone}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, phone: event.target.value }))
                      }
                      placeholder="Phone number"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-semibold text-cars-primary sm:col-span-2">
                    Preferred contact method
                    <select
                      className="h-12 w-full rounded-[20px] border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-background"
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
                  </label>
                </div>

                <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
                  <button
                    type="button"
                    onClick={() => void saveProfile()}
                    disabled={saving}
                    className="inline-flex h-11 w-full items-center justify-center rounded-full bg-cars-primary px-5 text-sm font-semibold text-white transition hover:bg-cars-accent disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                  >
                    {saving ? "Saving..." : "Save profile"}
                  </button>
                  <span className="text-sm text-cars-gray">
                    Sellers will see the most recent details you save here.
                  </span>
                </div>
              </div>

              <aside className="rounded-[26px] bg-cars-off-white p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                  Used in requests
                </p>
                <h2 className="mt-2 text-2xl font-apercu-bold text-cars-primary">
                  Ready for sellers
                </h2>
                <p className="mt-3 text-sm leading-6 text-cars-gray">
                  When your email and phone number are saved here, CarVista can prefill viewing
                  requests and avoid repetitive popups.
                </p>

                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1">
                  <div className="min-w-0 rounded-[20px] bg-white/80 px-4 py-3 dark:bg-background/80">
                    <dt className="font-medium text-cars-primary">Current email</dt>
                    <dd className="mt-1 break-words text-cars-gray">
                      {profile?.email || "Missing"}
                    </dd>
                  </div>
                  <div className="min-w-0 rounded-[20px] bg-white/80 px-4 py-3 dark:bg-background/80">
                    <dt className="font-medium text-cars-primary">Current phone</dt>
                    <dd className="mt-1 break-words text-cars-gray">
                      {profile?.phone || "Missing"}
                    </dd>
                  </div>
                  <div className="min-w-0 rounded-[20px] bg-white/80 px-4 py-3 dark:bg-background/80 sm:col-span-2 xl:col-span-1">
                    <dt className="font-medium text-cars-primary">Preferred contact</dt>
                    <dd className="mt-1 break-words text-cars-gray">
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
