"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Building2, CheckCheck, Clock3, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { useAiAssistant } from "@/components/ai/AiAssistantProvider";
import PageIntelligencePanel from "@/components/ai/PageIntelligencePanel";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import PriceHistoryChart from "@/components/catalog/PriceHistoryChart";
import StatusBanner from "@/components/common/StatusBanner";
import Header from "@/components/layout/Header";
import {
  buildListingTitle,
  formatBodyType,
  formatFuelType,
  formatListingPrice,
  formatLocation,
  formatMileage,
  formatTransmission,
} from "@/components/listings/listing-utils";
import CompleteProfileDialog from "@/components/requests/CompleteProfileDialog";
import StarRating from "@/components/reviews/StarRating";
import { authApi, catalogApi, listingsApi, requestsApi, reviewsApi, watchlistApi } from "@/lib/carvista-api";
import { ApiError, hasToken, toDateTime } from "@/lib/api-client";
import type { ListingDetail, SellerReview, User, ViewingRequest } from "@/lib/types";
import { buildMarketplaceSellerProfile } from "@/lib/seller-profile";
import {
  DEFAULT_VIEWING_REQUEST_MESSAGE,
  getRequestStatusLabel,
  isActiveViewingRequestStatus,
  preferredContactOptions,
  type PreferredContactMethod,
} from "@/lib/viewing-requests";

function getImageUrl(image: Record<string, unknown>): string | null {
  const value = image.url ?? image.image_url ?? image.src ?? image.image;
  return typeof value === "string" && value ? value : null;
}

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const { openAssistant, openCompare } = useAiAssistant();
  const { openAuth } = useAuthModal();
  const id = Number(params.id);

  const [detail, setDetail] = useState<ListingDetail | null>(null);
  const [reviews, setReviews] = useState<SellerReview[]>([]);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [priceHistoryRows, setPriceHistoryRows] = useState<Array<Record<string, unknown>>>([]);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);

  const [profile, setProfile] = useState<User | null>(null);
  const [activeRequest, setActiveRequest] = useState<ViewingRequest | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [requestPanelMessage, setRequestPanelMessage] = useState("");
  const [requestPanelTone, setRequestPanelTone] = useState<"success" | "error" | "info">(
    "info"
  );

  const [requestMessage, setRequestMessage] = useState(DEFAULT_VIEWING_REQUEST_MESSAGE);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [preferredContactMethod, setPreferredContactMethod] =
    useState<PreferredContactMethod>("phone_or_email");

  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("Seller communication was good.");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const detailRes = await listingsApi.detail(id);
      setDetail(detailRes);
      try {
        const sellerReviews = await reviewsApi.sellerReviews(detailRes.listing.owner_id);
        setReviews(sellerReviews.items);
      } catch {
        setReviews([]);
      }

      if (hasToken()) {
        const [profileResponse, outboxResponse] = await Promise.all([
          authApi.me(),
          requestsApi.outbox(),
        ]);
        setProfile(profileResponse.user);
        const latestRequest =
          outboxResponse.items.find((item) => item.listing_id === detailRes.listing.listing_id) ||
          null;
        setActiveRequest(
          latestRequest && isActiveViewingRequestStatus(latestRequest.status) ? latestRequest : null
        );
      } else {
        setProfile(null);
        setActiveRequest(null);
      }
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not load listing detail");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (Number.isFinite(id)) {
      void load();
    }
  }, [id]);

  const gallery = useMemo(
    () => (detail?.images || []).map(getImageUrl).filter((item): item is string => Boolean(item)),
    [detail]
  );

  useEffect(() => {
    setSelectedImage(gallery[0] || null);
  }, [gallery]);

  useEffect(() => {
    const rawVariantId = detail?.listing?.variant_id;
    const variantId = Number(rawVariantId);
    if (!Number.isFinite(variantId) || variantId <= 0) {
      setPriceHistoryRows([]);
      return;
    }

    let cancelled = false;
    async function loadPriceHistory() {
      setPriceHistoryLoading(true);
      try {
        const priceResponse = await catalogApi.variantPriceHistory(variantId, 1, 60);
        if (!cancelled) setPriceHistoryRows(priceResponse.items ?? []);
      } catch {
        if (!cancelled) setPriceHistoryRows([]);
      } finally {
        if (!cancelled) setPriceHistoryLoading(false);
      }
    }

    void loadPriceHistory();
    return () => {
      cancelled = true;
    };
  }, [detail?.listing?.variant_id, id]);

  useEffect(() => {
    if (!profile) return;
    setContactName((current) => current || profile.name || "");
    setContactEmail((current) => current || profile.email || "");
    setContactPhone((current) => current || profile.phone || "");
    setPreferredContactMethod(
      ((profile.preferred_contact_method as PreferredContactMethod | null) ||
        "phone_or_email") as PreferredContactMethod
    );
  }, [profile]);

  const listingTitle = detail?.listing ? buildListingTitle(detail.listing) : "Listing details";
  const sellerProfile = useMemo(
    () =>
      detail?.listing
        ? buildMarketplaceSellerProfile({
            listing: detail.listing,
            seller: detail.seller,
            reviews,
          })
        : null,
    [detail, reviews]
  );
  const formControlClass =
    "w-full border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-slate-950/60 dark:text-white dark:placeholder:text-slate-400";

  async function sendRequest(e: FormEvent) {
    e.preventDefault();
    if (!hasToken()) {
      openAuth({ mode: "login", next: `/listings/${id}` });
      return;
    }

    const contactDraft = {
      name: contactName.trim() || profile?.name || "",
      email: contactEmail.trim() || profile?.email || "",
      phone: contactPhone.trim() || profile?.phone || "",
      preferred_contact_method: preferredContactMethod,
    };

    if (!contactDraft.email || !contactDraft.phone) {
      setProfileDialogOpen(true);
      return;
    }

    try {
      const shouldPersistProfile =
        !profile ||
        contactDraft.name !== (profile.name || "") ||
        contactDraft.email !== (profile.email || "") ||
        contactDraft.phone !== (profile.phone || "") ||
        contactDraft.preferred_contact_method !==
          ((profile.preferred_contact_method as PreferredContactMethod | null) ||
            "phone_or_email");

      let activeProfile = profile;
      if (shouldPersistProfile) {
        const updated = await authApi.updateMe({
          name: contactDraft.name,
          email: contactDraft.email,
          phone: contactDraft.phone,
          preferred_contact_method: contactDraft.preferred_contact_method,
        });
        activeProfile = updated.user;
        setProfile(updated.user);
      }

      const response = await requestsApi.createRequest(id, {
        message: requestMessage.trim() || DEFAULT_VIEWING_REQUEST_MESSAGE,
        contact_name: contactDraft.name,
        contact_email: contactDraft.email,
        contact_phone: contactDraft.phone,
        preferred_contact_method: contactDraft.preferred_contact_method,
      });

      const nextRequest =
        response.request ||
        ({
          request_id: response.request_id,
          listing_id: id,
          buyer_id: activeProfile?.user_id || 0,
          contact_name: contactDraft.name,
          contact_email: contactDraft.email,
          contact_phone: contactDraft.phone,
          preferred_contact_method: contactDraft.preferred_contact_method,
          message: requestMessage.trim() || DEFAULT_VIEWING_REQUEST_MESSAGE,
          status: "new",
        } satisfies ViewingRequest);

      setActiveRequest(nextRequest);
      setRequestPanelTone("success");
      setRequestPanelMessage(
        "Request sent. The seller now has your contact details and can follow up using your preferred method."
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setActiveRequest({
          request_id:
            Number((error.details as { request_id?: unknown } | undefined)?.request_id) || 0,
          listing_id: id,
          buyer_id: profile?.user_id || 0,
          contact_name: contactDraft.name,
          contact_email: contactDraft.email,
          contact_phone: contactDraft.phone,
          preferred_contact_method: contactDraft.preferred_contact_method,
          status:
            typeof (error.details as { status?: unknown } | undefined)?.status === "string"
              ? String((error.details as { status?: string }).status)
              : "new",
        });
        setRequestPanelTone("info");
        setRequestPanelMessage("You already have an active viewing request for this listing.");
        return;
      }

      setRequestPanelTone("error");
      setRequestPanelMessage(error instanceof Error ? error.message : "Request failed");
    }
  }

  async function saveListing() {
    if (!hasToken()) {
      openAuth({ mode: "login", next: `/listings/${id}` });
      return;
    }

    try {
      await watchlistApi.saveListing(id);
      setTone("success");
      setMessage("Saved to Saved Cars.");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not save listing");
    }
  }

  async function submitSellerReview(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    if (!hasToken()) {
      openAuth({ mode: "login", next: `/listings/${id}` });
      return;
    }

    try {
      await reviewsApi.createSellerReview({
        seller_id: detail.listing.owner_id,
        listing_id: detail.listing.listing_id,
        rating,
        comment: reviewComment,
      });
      setTone("success");
      setMessage("Seller review submitted.");
      const sellerReviews = await reviewsApi.sellerReviews(detail.listing.owner_id);
      setReviews(sellerReviews.items);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Seller review failed");
    }
  }

  return (
    <>
      <Header />
      <CompleteProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        initialProfile={{
          ...profile,
          name: contactName || profile?.name || "",
          email: contactEmail || profile?.email || "",
          phone: contactPhone || profile?.phone || "",
          preferred_contact_method: preferredContactMethod,
        }}
        onSaved={(user) => {
          setProfile(user);
          setContactName(user.name || "");
          setContactEmail(user.email || "");
          setContactPhone(user.phone || "");
          setPreferredContactMethod(
            ((user.preferred_contact_method as PreferredContactMethod | null) ||
              "phone_or_email") as PreferredContactMethod
          );
        }}
        submitLabel="Save contact details"
      />

      <main className="container-cars py-8">
        <section className="section-shell overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(233,241,255,0.9))] p-6 dark:bg-[linear-gradient(135deg,rgba(8,17,31,0.96),rgba(15,26,44,0.9))] md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
                Car for sale
              </p>
              <h1 className="mt-2 text-4xl font-apercu-bold text-cars-primary">{listingTitle}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
                Review the listing, then log in to save it, request a viewing, or submit a seller
                review after your interaction.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/listings"
                className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-white"
              >
                Back to listings
              </Link>
              {detail?.listing?.variant_id ? (
                <button
                  type="button"
                  onClick={() =>
                    openCompare({
                      variantId: detail.listing.variant_id,
                      variantLabel: listingTitle,
                      listingId: detail.listing.listing_id,
                      marketId: 1,
                    })
                  }
                  className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-white"
                >
                  Compare alternatives
                </button>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  openAssistant({
                    prompt: `Help me evaluate ${listingTitle}, including ownership cost, market outlook, and whether it fits my needs.`,
                    marketId: 1,
                    variantId: detail?.listing?.variant_id,
                    variantLabel: listingTitle,
                  })
                }
                className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-white"
              >
                Ask AI advisor
              </button>
              {!hasToken() ? (
                <button
                  type="button"
                  onClick={() => openAuth({ mode: "login", next: `/listings/${id}` })}
                  className="rounded-full bg-cars-primary px-4 py-2 text-sm font-semibold text-white"
                >
                  Login to interact
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <div className="mb-6 mt-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        {loading ? <p className="text-sm text-cars-gray">Loading listing detail...</p> : null}

        {detail?.listing ? (
          <section className="mb-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="section-shell p-6">
              <h2 className="text-2xl font-apercu-bold text-cars-primary">Listing gallery</h2>
              {selectedImage ? (
                <div className="mt-5 overflow-hidden rounded-[28px] bg-cars-off-white">
                  <img
                    src={selectedImage}
                    alt={listingTitle}
                    className="h-[360px] w-full object-cover"
                  />
                </div>
              ) : (
                <div className="mt-5 flex h-[360px] items-center justify-center rounded-[28px] bg-cars-off-white text-sm font-medium text-cars-gray">
                  No listing images uploaded yet.
                </div>
              )}

              {gallery.length > 1 ? (
                <div className="mt-4 grid grid-cols-4 gap-3">
                  {gallery.map((image) => (
                    <button
                      key={image}
                      type="button"
                      onClick={() => setSelectedImage(image)}
                      className={
                        image === selectedImage
                          ? "overflow-hidden rounded-[18px] ring-2 ring-cars-accent"
                          : "overflow-hidden rounded-[18px] border border-cars-gray-light/70"
                      }
                    >
                      <img src={image} alt={listingTitle} className="h-20 w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="section-shell p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                    Overview
                  </p>
                  <h2 className="mt-2 text-3xl font-apercu-bold text-cars-primary">
                    {formatListingPrice(detail.listing.asking_price)}
                  </h2>
                </div>
                <span className="rounded-full bg-cars-off-white px-3 py-1 text-sm font-semibold capitalize text-cars-primary">
                  {detail.listing.status}
                </span>
              </div>

              <div className="mt-6 grid gap-3 text-sm md:grid-cols-2">
                <p className="rounded-[20px] bg-cars-off-white px-4 py-3">
                  <span className="font-medium text-cars-primary">Seller:</span>{" "}
                  {sellerProfile?.sellerType || detail.listing.seller_type || "Private seller"}
                </p>
                <p className="rounded-[20px] bg-cars-off-white px-4 py-3">
                  <span className="font-medium text-cars-primary">Body style:</span>{" "}
                  {formatBodyType(detail.listing.body_type)}
                </p>
                <p className="rounded-[20px] bg-cars-off-white px-4 py-3">
                  <span className="font-medium text-cars-primary">Mileage:</span>{" "}
                  {formatMileage(detail.listing.mileage_km)}
                </p>
                <p className="rounded-[20px] bg-cars-off-white px-4 py-3">
                  <span className="font-medium text-cars-primary">Location:</span>{" "}
                  {formatLocation(detail.listing.location_city, detail.listing.location_country_code)}
                </p>
                <p className="rounded-[20px] bg-cars-off-white px-4 py-3">
                  <span className="font-medium text-cars-primary">Transmission:</span>{" "}
                  {formatTransmission(detail.listing.transmission)}
                </p>
                <p className="rounded-[20px] bg-cars-off-white px-4 py-3">
                  <span className="font-medium text-cars-primary">Fuel:</span>{" "}
                  {formatFuelType(detail.listing.fuel_type)}
                </p>
              </div>

              <p className="mt-6 text-sm leading-7 text-cars-gray">
                {detail.listing.description || "Seller has not added a description yet."}
              </p>

              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={saveListing}
                  className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
                >
                  Save listing
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {detail?.listing && sellerProfile ? (
          <section className="mb-8 section-shell p-6">
            <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
              <div className="rounded-[28px] border border-cars-primary/10 bg-cars-off-white/80 p-5 dark:border-cars-gray-light/30 dark:bg-slate-950/40">
                <div className="flex items-start gap-4">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cars-primary text-white shadow-[0_12px_28px_rgba(15,45,98,0.16)]">
                    <Building2 className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cars-accent">
                      Seller profile
                    </p>
                    <h2 className="mt-2 text-2xl font-apercu-bold text-cars-primary">
                      {sellerProfile.displayName}
                    </h2>
                    <p className="mt-2 text-sm text-cars-gray">{sellerProfile.sellerType}</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {sellerProfile.trustHighlights.map((highlight) => (
                    <span
                      key={highlight}
                      className="rounded-full border border-cars-primary/12 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-cars-gray"
                    >
                      {highlight}
                    </span>
                  ))}
                </div>

                <div className="mt-5 rounded-[22px] border border-cars-primary/10 bg-white/80 px-4 py-4 dark:border-cars-gray-light/25 dark:bg-slate-950/55">
                  <div className="flex flex-wrap items-center gap-3">
                    <StarRating value={sellerProfile.reviewAverage || 0} size="sm" />
                    <p className="text-sm font-medium text-cars-primary">
                      {sellerProfile.reviewAverage
                        ? `${sellerProfile.reviewAverage.toFixed(1)} average seller rating`
                        : "No seller ratings yet"}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-cars-gray">
                    {sellerProfile.reviewCount > 0
                      ? `${sellerProfile.reviewCount} review${sellerProfile.reviewCount === 1 ? "" : "s"} from CarVista buyers.`
                      : "Seller reviews will appear here once buyers leave feedback after contact or a viewing."}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cars-accent">
                  Who you are buying from
                </p>
                <p className="mt-3 text-sm leading-7 text-cars-gray">{sellerProfile.about}</p>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-[22px] border border-cars-gray-light/70 bg-cars-off-white/70 px-4 py-4 dark:bg-slate-950/40">
                    <p className="flex items-center gap-2 text-sm font-semibold text-cars-primary">
                      <Phone className="h-4 w-4 text-cars-accent" />
                      Contact phone
                    </p>
                    {sellerProfile.phone ? (
                      <a
                        href={`tel:${sellerProfile.phone}`}
                        className="mt-2 inline-flex text-sm font-medium text-cars-primary transition hover:text-cars-accent"
                      >
                        {sellerProfile.phone}
                      </a>
                    ) : (
                      <p className="mt-2 text-sm text-cars-gray">
                        Available after you send a request
                      </p>
                    )}
                  </div>
                  <div className="rounded-[22px] border border-cars-gray-light/70 bg-cars-off-white/70 px-4 py-4 dark:bg-slate-950/40">
                    <p className="flex items-center gap-2 text-sm font-semibold text-cars-primary">
                      <Mail className="h-4 w-4 text-cars-accent" />
                      Email
                    </p>
                    {sellerProfile.email ? (
                      <a
                        href={`mailto:${sellerProfile.email}`}
                        className="mt-2 inline-flex text-sm font-medium text-cars-primary transition hover:text-cars-accent"
                      >
                        {sellerProfile.email}
                      </a>
                    ) : (
                      <p className="mt-2 text-sm text-cars-gray">Shared after contact</p>
                    )}
                  </div>
                  <div className="rounded-[22px] border border-cars-gray-light/70 bg-cars-off-white/70 px-4 py-4 dark:bg-slate-950/40">
                    <p className="flex items-center gap-2 text-sm font-semibold text-cars-primary">
                      <MapPin className="h-4 w-4 text-cars-accent" />
                      Address
                    </p>
                    <p className="mt-2 text-sm text-cars-gray">{sellerProfile.addressLine}</p>
                  </div>
                  <div className="rounded-[22px] border border-cars-gray-light/70 bg-cars-off-white/70 px-4 py-4 dark:bg-slate-950/40">
                    <p className="flex items-center gap-2 text-sm font-semibold text-cars-primary">
                      <Clock3 className="h-4 w-4 text-cars-accent" />
                      Availability
                    </p>
                    <p className="mt-2 text-sm text-cars-gray">{sellerProfile.availability}</p>
                  </div>
                </div>

                <div className="mt-5 rounded-[22px] border border-cars-primary/10 bg-cars-off-white/70 px-4 py-4 dark:bg-slate-950/40">
                  <p className="flex items-center gap-2 text-sm font-semibold text-cars-primary">
                    <ShieldCheck className="h-4 w-4 text-cars-accent" />
                    Why this matters
                  </p>
                  <p className="mt-2 text-sm leading-6 text-cars-gray">
                    Review the seller details before you request a viewing so you know who is
                    offering the car, how they prefer to be contacted, and what kind of follow-up to expect.
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {detail?.listing ? (
          <PageIntelligencePanel
            subjectType="listing"
            subjectId={id}
            marketId={1}
            title="AI price and ownership snapshot"
            className="mb-8"
            compactLayout
            hiddenSectionKeys={["listing_value_position", "fit_for_you"]}
            showActionPaths={false}
            showSectionCaveats={false}
            showSectionSources={false}
          />
        ) : null}

        {detail?.listing?.variant_id ? (
          <section className="mb-8 section-shell p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-apercu-bold text-cars-primary">Price history</h2>
                <p className="mt-3 text-sm leading-6 text-cars-gray">
                  Review the recent market trail for this exact vehicle before you decide whether the asking price feels fair.
                </p>
              </div>
              {priceHistoryLoading ? (
                <p className="text-sm text-cars-gray">Loading history...</p>
              ) : null}
            </div>

            <PriceHistoryChart rows={priceHistoryRows} />
          </section>
        ) : null}

        <section className="mb-8 grid gap-6 xl:grid-cols-2">
          <div className="section-shell p-6">
            <h2 className="text-2xl font-apercu-bold text-cars-primary">Request a viewing</h2>
            <p className="mt-3 text-sm leading-6 text-cars-gray">
              We will prefill your saved contact details so the seller can follow up without extra
              back-and-forth.
            </p>

            <div className="mt-4">
              <StatusBanner tone={requestPanelTone}>{requestPanelMessage}</StatusBanner>
            </div>

            {activeRequest ? (
              <div className="mt-5 rounded-[24px] border border-emerald-200 bg-emerald-50/90 p-4 dark:border-emerald-400/20 dark:bg-emerald-500/10">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100">
                    <CheckCheck className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-100">
                      Viewing request sent
                    </p>
                    <p className="mt-1 text-sm leading-6 text-emerald-700 dark:text-emerald-100/90">
                      Current seller status: {getRequestStatusLabel(activeRequest.status)}
                      {activeRequest.created_at
                        ? ` - Sent ${toDateTime(activeRequest.created_at)}`
                        : ""}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {!activeRequest ? (
              <form onSubmit={sendRequest} className="space-y-3">
                <input
                  className={`mt-5 h-11 rounded-full ${formControlClass}`}
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Your name"
                />
                <input
                  className={`h-11 rounded-full ${formControlClass}`}
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="Email address"
                />
                <input
                  className={`h-11 rounded-full ${formControlClass}`}
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Phone number"
                />
                <select
                  className={`h-11 rounded-full ${formControlClass}`}
                  value={preferredContactMethod}
                  onChange={(event) =>
                    setPreferredContactMethod(event.target.value as PreferredContactMethod)
                  }
                >
                  {preferredContactOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      Preferred contact: {option.label}
                    </option>
                  ))}
                </select>
                <textarea
                  className={`min-h-[120px] rounded-[24px] py-3 ${formControlClass}`}
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  placeholder="Tell the seller when you would like to view the car."
                />
                <button
                  className="rounded-full bg-cars-accent px-5 py-2.5 text-sm font-semibold text-white"
                  type="submit"
                >
                  Send request
                </button>
              </form>
            ) : (
              <div className="mt-5 grid gap-3 text-sm">
                <div className="rounded-[20px] border border-cars-gray-light/70 bg-cars-off-white/60 px-4 py-3 dark:bg-slate-950/40">
                  <span className="font-medium text-cars-primary">Email:</span>{" "}
                  {activeRequest.contact_email || contactEmail || "Saved to profile"}
                </div>
                <div className="rounded-[20px] border border-cars-gray-light/70 bg-cars-off-white/60 px-4 py-3 dark:bg-slate-950/40">
                  <span className="font-medium text-cars-primary">Phone:</span>{" "}
                  {activeRequest.contact_phone || contactPhone || "Saved to profile"}
                </div>
                <div className="rounded-[20px] border border-cars-gray-light/70 bg-cars-off-white/60 px-4 py-3 dark:bg-slate-950/40">
                  <span className="font-medium text-cars-primary">Preferred contact:</span>{" "}
                  {preferredContactOptions.find(
                    (option) => option.value === activeRequest.preferred_contact_method
                  )?.label || "Phone or email"}
                </div>
              </div>
            )}
          </div>

          <div className="section-shell p-6">
            <h2 className="text-2xl font-apercu-bold text-cars-primary">Create seller review</h2>
            <p className="mt-3 text-sm leading-6 text-cars-gray">
              Leave a rating and comment for the seller after a real interaction.
            </p>
            <form onSubmit={submitSellerReview} className="space-y-3">
              <div className="mt-5 rounded-[24px] border border-cars-gray-light/70 bg-cars-off-white/60 px-4 py-4 dark:bg-slate-950/40">
                <p className="text-sm font-semibold text-cars-primary">Seller rating</p>
                <div className="mt-3">
                  <StarRating value={rating} onChange={setRating} size="lg" />
                </div>
              </div>
              <textarea
                className={`min-h-[120px] rounded-[24px] py-3 ${formControlClass}`}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share how the seller communicated, followed up, and handled the viewing."
              />
              <button
                className="rounded-full bg-cars-primary px-5 py-2.5 text-sm font-semibold text-white"
                type="submit"
              >
                Submit seller review
              </button>
            </form>
          </div>
        </section>

        <section className="mb-8 section-shell p-6">
          <h2 className="text-2xl font-apercu-bold text-cars-primary">Seller reviews</h2>
          <div className="space-y-3 text-sm">
            {reviews.length === 0 ? (
              <p className="mt-4 text-cars-gray">No seller reviews yet.</p>
            ) : null}
            {reviews.map((review, index) => (
              <div
                key={review.seller_review_id || index}
                className="mt-4 rounded-[22px] border border-cars-gray-light/70 bg-cars-off-white/55 p-4 dark:bg-slate-950/35"
              >
                <div className="flex items-center justify-between gap-3">
                  <StarRating value={Number(review.rating || 0)} size="sm" />
                  {review.created_at ? (
                    <span className="text-xs text-cars-gray">{toDateTime(review.created_at)}</span>
                  ) : null}
                </div>
                <p className="mt-2 text-cars-gray">{review.comment || "-"}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
