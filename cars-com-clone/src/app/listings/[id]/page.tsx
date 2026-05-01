"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import {
  Building2,
  CheckCheck,
  Clock3,
  Heart,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
} from "lucide-react";
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
import {
  authApi,
  catalogApi,
  listingsApi,
  requestsApi,
  reviewsApi,
  watchlistApi,
} from "@/lib/carvista-api";
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

function getSellerReviewKey(review: SellerReview) {
  return String(
    review.seller_review_id || `${review.comment || ""}-${review.created_at || ""}`
  );
}

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const { openCompare } = useAiAssistant();
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

  const load = useCallback(async () => {
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
          latestRequest && isActiveViewingRequestStatus(latestRequest.status)
            ? latestRequest
            : null
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
  }, [id]);

  useEffect(() => {
    if (Number.isFinite(id)) {
      void load();
    }
  }, [id, load]);

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
      setPriceHistoryLoading(false);
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
  }, [detail?.listing?.variant_id]);

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

  const summaryCards = useMemo(
    () =>
      detail?.listing
        ? [
            {
              label: "Seller",
              value: sellerProfile?.sellerType || detail.listing.seller_type || "Private seller",
            },
            { label: "Body style", value: formatBodyType(detail.listing.body_type) },
            { label: "Mileage", value: formatMileage(detail.listing.mileage_km) },
            {
              label: "Location",
              value: formatLocation(
                detail.listing.location_city,
                detail.listing.location_country_code
              ),
            },
            {
              label: "Transmission",
              value: formatTransmission(detail.listing.transmission),
            },
            { label: "Fuel", value: formatFuelType(detail.listing.fuel_type) },
          ]
        : [],
    [detail, sellerProfile]
  );

  const sendRequest = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
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
            contact_name: contactName.trim() || profile?.name || "",
            contact_email: contactEmail.trim() || profile?.email || "",
            contact_phone: contactPhone.trim() || profile?.phone || "",
            preferred_contact_method: preferredContactMethod,
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
    },
    [
      contactEmail,
      contactName,
      contactPhone,
      id,
      openAuth,
      preferredContactMethod,
      profile,
      requestMessage,
    ]
  );

  const saveListing = useCallback(async () => {
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
  }, [id, openAuth]);

  const submitSellerReview = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
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
    },
    [detail, id, openAuth, rating, reviewComment]
  );

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

      <main className="container-cars py-6 sm:py-8">
        <section className="section-shell overflow-hidden border-white/10 bg-[linear-gradient(135deg,rgba(14,20,31,0.98),rgba(12,18,27,0.98),rgba(18,27,42,0.94))] p-5 sm:p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8fb4ff]">
                Car for sale
              </p>
              <h1 className="mt-2 text-3xl font-apercu-bold text-slate-50 sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
                {listingTitle}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Review the listing, then log in to save it, request a viewing, or submit a seller
                review after your interaction.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto xl:flex xl:flex-wrap xl:justify-end">
              <Link
                href="/listings"
                className="inline-flex h-11 w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10 sm:w-auto"
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
                  className="inline-flex h-11 w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10 sm:w-auto"
                >
                  Compare alternatives
                </button>
              ) : null}
              {!hasToken() ? (
                <button
                  type="button"
                  onClick={() => openAuth({ mode: "login", next: `/listings/${id}` })}
                  className="editorial-button inline-flex h-11 w-full items-center justify-center rounded-full px-4 text-sm font-semibold text-slate-950 sm:w-auto"
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

        {loading ? <p className="text-sm text-slate-300">Loading listing detail...</p> : null}

        {detail?.listing ? (
          <section className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)] xl:items-start">
            <div className="section-shell p-4 sm:p-5 md:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-apercu-bold text-cars-primary sm:text-2xl">
                    Listing gallery
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-cars-gray">
                    Review the photos first so the condition and presentation are clear before you
                    reach out to the seller.
                  </p>
                </div>
              </div>

              {selectedImage ? (
                <div className="mt-5 overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_top,rgba(143,180,255,0.16),transparent_48%),linear-gradient(180deg,rgba(16,22,32,0.96),rgba(10,14,20,0.98))] sm:rounded-[28px]">
                  <div className="aspect-[16/10] sm:aspect-[16/9]">
                    <img
                      src={selectedImage}
                      alt={listingTitle}
                      className="h-full w-full object-contain"
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-5 flex aspect-[16/10] items-center justify-center rounded-[24px] bg-[radial-gradient(circle_at_top,rgba(143,180,255,0.16),transparent_48%),linear-gradient(180deg,rgba(16,22,32,0.96),rgba(10,14,20,0.98))] px-6 text-center text-sm font-medium text-slate-300 sm:rounded-[28px] sm:aspect-[16/9]">
                  No listing images uploaded yet.
                </div>
              )}

              {gallery.length > 1 ? (
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
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
                      <div className="aspect-[4/3]">
                        <img
                          src={image}
                          alt={listingTitle}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="section-shell self-start p-4 sm:p-5 md:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                    Overview
                  </p>
                  <h2 className="mt-2 break-words text-2xl font-apercu-bold leading-tight text-cars-primary sm:text-3xl">
                    {formatListingPrice(detail.listing.asking_price)}
                  </h2>
                </div>
                <span className="inline-flex self-start rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#c5f6ff]">
                  {detail.listing.status}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {summaryCards.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[20px] border border-white/8 bg-white/5 px-4 py-3 text-sm"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                      {item.label}
                    </p>
                    <p className="mt-2 break-words font-medium leading-6 text-cars-primary">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-5 text-sm leading-7 text-cars-gray">
                {detail.listing.description || "Seller has not added a description yet."}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={saveListing}
                  aria-label="Save listing"
                  className="inline-flex h-11 w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-slate-100 transition-colors hover:bg-white/10"
                >
                  <Heart className="h-[18px] w-[18px]" />
                </button>
                <Link
                  href="#request-viewing"
                  className="editorial-button inline-flex h-11 w-full items-center justify-center rounded-full px-4 text-sm font-semibold text-slate-950 transition-colors hover:brightness-105"
                >
                  Request viewing
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        {detail?.listing && sellerProfile ? (
          <section className="mb-8 section-shell p-4 sm:p-5 md:p-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] xl:items-start">
              <div className="rounded-[28px] border border-cars-primary/10 bg-cars-off-white/80 p-5 dark:border-cars-gray-light/30 dark:bg-slate-950/40">
                <div className="flex items-start gap-4">
                  <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cars-primary text-primary-foreground shadow-[0_12px_28px_rgba(15,45,98,0.16)]">
                    <Building2 className="h-6 w-6" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cars-accent">
                      Seller profile
                    </p>
                    <h2 className="mt-2 break-words text-2xl font-apercu-bold text-cars-primary">
                      {sellerProfile.displayName}
                    </h2>
                    <p className="mt-2 text-sm text-cars-gray">{sellerProfile.sellerType}</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {sellerProfile.trustHighlights.map((highlight) => (
                    <span
                      key={highlight}
                      className="max-w-full break-words rounded-full border border-cars-primary/12 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-cars-gray"
                    >
                      {highlight}
                    </span>
                  ))}
                </div>

                <div className="mt-5 rounded-[22px] border border-cars-primary/10 bg-white/80 px-4 py-4 dark:border-cars-gray-light/25 dark:bg-slate-950/55">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                        Seller rating
                      </p>
                      <p className="mt-2 text-sm font-medium text-cars-primary">
                        {sellerProfile.reviewAverage
                          ? `${sellerProfile.reviewAverage.toFixed(1)} average seller rating`
                          : "No seller ratings yet"}
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <StarRating
                        value={sellerProfile.reviewAverage || 0}
                        size="sm"
                        showValue={false}
                      />
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-cars-gray">
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

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-cars-gray-light/70 bg-cars-off-white/70 px-4 py-4 dark:bg-slate-950/40">
                    <p className="flex items-center gap-2 text-sm font-semibold text-cars-primary">
                      <Phone className="h-4 w-4 text-cars-accent" />
                      Contact phone
                    </p>
                    {sellerProfile.phone ? (
                      <a
                        href={`tel:${sellerProfile.phone}`}
                        className="mt-2 inline-flex break-all text-sm font-medium text-cars-primary transition hover:text-cars-accent"
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
                        className="mt-2 inline-flex break-all text-sm font-medium text-cars-primary transition hover:text-cars-accent"
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
                    <p className="mt-2 break-words text-sm text-cars-gray">
                      {sellerProfile.addressLine}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-cars-gray-light/70 bg-cars-off-white/70 px-4 py-4 dark:bg-slate-950/40">
                    <p className="flex items-center gap-2 text-sm font-semibold text-cars-primary">
                      <Clock3 className="h-4 w-4 text-cars-accent" />
                      Availability
                    </p>
                    <p className="mt-2 break-words text-sm text-cars-gray">
                      {sellerProfile.availability}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-[22px] border border-cars-primary/10 bg-cars-off-white/70 px-4 py-4 dark:bg-slate-950/40">
                  <p className="flex items-center gap-2 text-sm font-semibold text-cars-primary">
                    <ShieldCheck className="h-4 w-4 text-cars-accent" />
                    Why this matters
                  </p>
                  <p className="mt-2 text-sm leading-6 text-cars-gray">
                    Review the seller details before you request a viewing so you know who is
                    offering the car, how they prefer to be contacted, and what kind of follow-up
                    to expect.
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
            hiddenSectionKeys={["listing_value_position"]}
            showActionPaths={false}
            showSectionCaveats={false}
            showSectionSources={false}
          />
        ) : null}

        {detail?.listing?.variant_id ? (
          <section className="mb-8 section-shell p-4 sm:p-5 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-apercu-bold text-cars-primary sm:text-2xl">
                  Price history
                </h2>
                <p className="mt-3 text-sm leading-6 text-cars-gray">
                  Review the recent market trail for this exact vehicle before you decide whether
                  the asking price feels fair.
                </p>
              </div>
              {priceHistoryLoading ? (
                <p className="text-sm text-cars-gray">Loading history...</p>
              ) : null}
            </div>

            <PriceHistoryChart rows={priceHistoryRows} />
          </section>
        ) : null}

        <section className="mb-8 grid gap-6 lg:grid-cols-2">
          <div id="request-viewing" className="section-shell scroll-mt-28 p-4 sm:p-5 md:p-6">
            <h2 className="text-xl font-apercu-bold text-cars-primary sm:text-2xl">
              Request a viewing
            </h2>
            <p className="mt-3 text-sm leading-6 text-cars-gray">
              We will prefill your saved contact details so the seller can follow up without extra
              back-and-forth.
            </p>

            {requestPanelMessage ? (
              <div className="mt-4">
                <StatusBanner tone={requestPanelTone}>{requestPanelMessage}</StatusBanner>
              </div>
            ) : null}

            {activeRequest ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/90 p-4 dark:border-emerald-400/20 dark:bg-emerald-500/10">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100">
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

                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-[20px] border border-cars-gray-light/70 bg-cars-off-white/60 px-4 py-3 dark:bg-slate-950/40">
                    <span className="font-medium text-cars-primary">Email:</span>{" "}
                    {activeRequest.contact_email || contactEmail || "Saved to profile"}
                  </div>
                  <div className="rounded-[20px] border border-cars-gray-light/70 bg-cars-off-white/60 px-4 py-3 dark:bg-slate-950/40">
                    <span className="font-medium text-cars-primary">Phone:</span>{" "}
                    {activeRequest.contact_phone || contactPhone || "Saved to profile"}
                  </div>
                  <div className="rounded-[20px] border border-cars-gray-light/70 bg-cars-off-white/60 px-4 py-3 dark:bg-slate-950/40 sm:col-span-2">
                    <span className="font-medium text-cars-primary">Preferred contact:</span>{" "}
                    {preferredContactOptions.find(
                      (option) => option.value === activeRequest.preferred_contact_method
                    )?.label || "Phone or email"}
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={sendRequest} className="mt-5 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    className={`h-11 rounded-full ${formControlClass}`}
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                    placeholder="Your name"
                  />
                  <input
                    className={`h-11 rounded-full ${formControlClass}`}
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    placeholder="Email address"
                  />
                  <input
                    className={`h-11 rounded-full ${formControlClass}`}
                    value={contactPhone}
                    onChange={(event) => setContactPhone(event.target.value)}
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
                </div>
                <textarea
                  className={`min-h-[120px] rounded-[24px] py-3 ${formControlClass}`}
                  value={requestMessage}
                  onChange={(event) => setRequestMessage(event.target.value)}
                  placeholder="Tell the seller when you would like to view the car."
                />
                <button
                  className="editorial-button inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-105 dark:text-slate-950 sm:w-auto"
                  type="submit"
                >
                  Send request
                </button>
              </form>
            )}
          </div>

          <div className="section-shell p-4 sm:p-5 md:p-6">
            <h2 className="text-xl font-apercu-bold text-cars-primary sm:text-2xl">
              Create seller review
            </h2>
            <p className="mt-3 text-sm leading-6 text-cars-gray">
              Leave a rating and comment for the seller after a real interaction.
            </p>
            <form onSubmit={submitSellerReview} className="mt-5 space-y-3">
              <div className="rounded-[24px] border border-cars-gray-light/70 bg-cars-off-white/60 px-4 py-4 dark:bg-slate-950/40">
                <p className="text-sm font-semibold text-cars-primary">Seller rating</p>
                <div className="mt-3 overflow-x-auto">
                  <StarRating value={rating} onChange={setRating} size="lg" />
                </div>
              </div>
              <textarea
                className={`min-h-[120px] rounded-[24px] py-3 ${formControlClass}`}
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                placeholder="Share how the seller communicated, followed up, and handled the viewing."
              />
              <button
                className="inline-flex w-full items-center justify-center rounded-full bg-cars-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground sm:w-auto"
                type="submit"
              >
                Submit seller review
              </button>
            </form>
          </div>
        </section>

        <section className="mb-8 section-shell p-4 sm:p-5 md:p-6">
          <h2 className="text-xl font-apercu-bold text-cars-primary sm:text-2xl">
            Seller reviews
          </h2>
          <div className="space-y-3 text-sm">
            {reviews.length === 0 ? (
              <p className="mt-4 text-cars-gray">No seller reviews yet.</p>
            ) : null}
            {reviews.map((review) => (
              <div
                key={getSellerReviewKey(review)}
                className="mt-4 rounded-[22px] border border-cars-gray-light/70 bg-cars-off-white/55 p-4 dark:bg-slate-950/35"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="overflow-x-auto">
                    <StarRating value={Number(review.rating || 0)} size="sm" />
                  </div>
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
