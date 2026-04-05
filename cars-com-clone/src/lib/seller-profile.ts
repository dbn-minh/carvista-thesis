import type { Listing, ListingSeller, SellerReview } from "./types";

type SellerPersonaOverride = {
  displayName: string;
  sellerType: string;
  about: string;
  phone?: string | null;
  website?: string | null;
  addressPrefix?: string | null;
  availability: string;
  trustHighlights: string[];
};

export type MarketplaceSellerProfile = {
  displayName: string;
  sellerType: string;
  about: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  addressLine: string;
  availability: string;
  trustHighlights: string[];
  reviewAverage: number | null;
  reviewCount: number;
};

const demoSellerOverrides: Record<number, SellerPersonaOverride> = {
  1: {
    displayName: "Saigon Signature Motors",
    sellerType: "Showroom",
    about:
      "Curated used sedans, hybrids, and family SUVs with documented service history and walk-around inspections before every viewing.",
    phone: "(028) 7308-1188",
    addressPrefix: "District 7 showroom",
    availability: "Mon - Sat · 8:30 AM - 6:30 PM",
    trustHighlights: ["Inspected inventory", "Walk-in showroom", "Trade-in support"],
  },
  2: {
    displayName: "Metro Auto House",
    sellerType: "Dealer",
    about:
      "Multi-brand dealer focused on late-model daily drivers, financing-friendly stock, and practical family cars for city use.",
    phone: "(028) 7106-2244",
    addressPrefix: "Thu Duc retail lot",
    availability: "Mon - Sun · 9:00 AM - 7:00 PM",
    trustHighlights: ["Dealer stock", "Weekend appointments", "Financing support"],
  },
  3: {
    displayName: "BlueLine Premium Cars",
    sellerType: "Company",
    about:
      "Premium pre-owned inventory with a focus on clean-condition European SUVs, executive sedans, and transparent ownership history.",
    phone: "(024) 7771-5505",
    addressPrefix: "Main office",
    availability: "Mon - Sat · 8:00 AM - 6:00 PM",
    trustHighlights: ["Premium inventory", "Documentation ready", "Appointment-first"],
  },
  4: {
    displayName: "Riverside Auto Gallery",
    sellerType: "Dealer",
    about:
      "Independent dealer that keeps a smaller handpicked inventory, with direct seller conversations and flexible viewing slots.",
    phone: "(028) 7102-4466",
    addressPrefix: "Riverside branch",
    availability: "Daily · 8:30 AM - 6:00 PM",
    trustHighlights: ["Handpicked stock", "Flexible viewing", "Fast seller response"],
  },
  5: {
    displayName: "Northstar Commercial Vehicles",
    sellerType: "Company",
    about:
      "Commercial and fleet-oriented inventory for vans, pickups, and utility-focused buyers who need fast operational handover.",
    phone: "(028) 7303-8822",
    addressPrefix: "Commercial yard",
    availability: "Mon - Fri · 8:00 AM - 5:30 PM",
    trustHighlights: ["Fleet-ready", "Commercial support", "Invoice assistance"],
  },
  6: {
    displayName: "Eastside Auto Point",
    sellerType: "Dealer",
    about:
      "Neighborhood dealer with a practical mix of family SUVs, hatchbacks, and city-friendly used cars ready for same-week viewings.",
    phone: "(028) 7105-9911",
    addressPrefix: "Eastside branch",
    availability: "Daily · 9:00 AM - 6:30 PM",
    trustHighlights: ["Family cars", "Weekend slots", "Local pickup"],
  },
  7: {
    displayName: "Harborline Car Exchange",
    sellerType: "Showroom",
    about:
      "Showroom-style inventory focused on clean-condition imports and premium commuter cars with transparent discussion before viewing.",
    phone: "(028) 7307-4400",
    addressPrefix: "Harbor showroom",
    availability: "Mon - Sat · 8:30 AM - 6:00 PM",
    trustHighlights: ["Showroom handover", "Import-focused", "Appointment support"],
  },
  8: {
    displayName: "Green Mile EV & Hybrid",
    sellerType: "Company",
    about:
      "Specialist inventory for electrified cars, hybrids, and efficient daily drivers with guidance on charging and ownership basics.",
    phone: "(028) 7108-3322",
    addressPrefix: "EV center",
    availability: "Mon - Sun · 9:00 AM - 7:00 PM",
    trustHighlights: ["Hybrid & EV focus", "Battery guidance", "Ownership walkthrough"],
  },
  9: {
    displayName: "Summit Used Auto",
    sellerType: "Dealer",
    about:
      "Independent used-car dealer with a smaller stock list and quick appointment handling for buyers who want a straightforward transaction.",
    phone: "(024) 6686-1200",
    addressPrefix: "Summit lot",
    availability: "Mon - Sat · 8:00 AM - 5:30 PM",
    trustHighlights: ["Straightforward pricing", "Quick follow-up", "Small curated stock"],
  },
  10: {
    displayName: "Cityline Premium Select",
    sellerType: "Showroom",
    about:
      "Premium-focused seller profile for executive sedans, SUVs, and cleaner-condition trade-ins presented in a showroom setting.",
    phone: "(024) 7779-6655",
    addressPrefix: "Central showroom",
    availability: "Daily · 9:00 AM - 6:30 PM",
    trustHighlights: ["Premium stock", "Clean trade-ins", "Viewing concierge"],
  },
};

function buildFallbackAbout(listing: Listing, sellerType: string) {
  const location = [listing.location_city, listing.location_country_code].filter(Boolean).join(", ");
  const vehicleFocus = [listing.make_name, listing.model_name, listing.body_type]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (sellerType === "Private seller") {
    return vehicleFocus
      ? `Private seller listing a ${vehicleFocus}. Contact directly to discuss condition, viewing availability, and ownership history.`
      : "Private seller available for direct questions about condition, ownership history, and viewing availability.";
  }

  if (location) {
    return `Independent seller based in ${location}, offering direct contact and flexible appointments for serious buyers.`;
  }

  return "Independent seller available for direct questions and viewing appointments.";
}

function buildFallbackName(listing: Listing, seller?: ListingSeller | null) {
  if (seller?.name?.trim()) return seller.name.trim();
  if (listing.location_city?.trim()) return `${listing.location_city.trim()} Auto House`;
  return "CarVista Seller";
}

function buildAddressLine(listing: Listing, override?: SellerPersonaOverride) {
  const location = [listing.location_city, listing.location_country_code].filter(Boolean).join(", ");
  if (override?.addressPrefix && location) return `${override.addressPrefix}, ${location}`;
  if (override?.addressPrefix) return override.addressPrefix;
  return location || "Address shared after initial contact";
}

function buildTrustHighlights(sellerType: string, override?: SellerPersonaOverride) {
  if (override?.trustHighlights?.length) return override.trustHighlights;
  if (sellerType === "Private seller") {
    return ["Direct owner contact", "Viewing by appointment", "Discussion before meeting"];
  }
  return ["Verified contact details", "Viewing appointments", "Marketplace seller profile"];
}

function summarizeReviews(reviews: SellerReview[]) {
  if (!reviews.length) {
    return { reviewAverage: null, reviewCount: 0 };
  }

  const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
  return {
    reviewAverage: Number((total / reviews.length).toFixed(1)),
    reviewCount: reviews.length,
  };
}

export function buildMarketplaceSellerProfile({
  listing,
  seller,
  reviews,
}: {
  listing: Listing;
  seller?: ListingSeller | null;
  reviews: SellerReview[];
}): MarketplaceSellerProfile {
  const override = listing.owner_id ? demoSellerOverrides[listing.owner_id] : undefined;
  const sellerType = override?.sellerType || listing.seller_type || "Private seller";
  const reviewSummary = summarizeReviews(reviews);

  return {
    displayName: override?.displayName || buildFallbackName(listing, seller),
    sellerType,
    about: override?.about || buildFallbackAbout(listing, sellerType),
    phone: override?.phone || seller?.phone || null,
    email: seller?.email || null,
    website: override?.website || null,
    addressLine: buildAddressLine(listing, override),
    availability: override?.availability || "Daily · Contact to schedule a viewing",
    trustHighlights: buildTrustHighlights(sellerType, override),
    reviewAverage: reviewSummary.reviewAverage,
    reviewCount: reviewSummary.reviewCount,
  };
}

export function getMarketplaceSellerType(listing: Listing) {
  return demoSellerOverrides[listing.owner_id]?.sellerType || listing.seller_type || "Private seller";
}
