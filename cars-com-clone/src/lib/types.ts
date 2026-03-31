export type ApiErrorShape = {
  message?: string;
  details?: unknown;
  status?: number;
};

export type User = {
  user_id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
};

export type AuthResponse = {
  token: string;
  user?: User | null;
};

export type AuthProvidersResponse = {
  social: {
    google: boolean;
    facebook: boolean;
  };
};

export type Make = {
  make_id: number;
  name: string;
};

export type Model = {
  model_id: number;
  make_id: number;
  name: string;
};

export type VariantListItem = {
  variant_id: number;
  model_year: number;
  trim_name: string | null;
  body_type: string | null;
  fuel_type: string | null;
  engine: string | null;
  transmission: string | null;
  drivetrain: string | null;
  msrp_base: number | null;
  model_id: number;
  model_name: string;
  make_id: number;
  make_name: string;
};

export type VariantDetail = {
  variant: Record<string, unknown> | null;
  spec: Record<string, unknown> | null;
  kv: Array<Record<string, unknown>>;
  images: Array<Record<string, unknown>>;
};

export type AdvisorProfile = {
  budget_max?: number | null;
  environment?: string | null;
  long_trip_habit?: string | null;
  passenger_count?: number | null;
  preferred_body_type?: string | null;
  preferred_fuel_type?: string | null;
  maintenance_sensitivity?: string | null;
  personality?: string | null;
  brand_openness?: string | null;
  new_vs_used?: string | null;
};

export type AiInsightCard = {
  title: string;
  value?: string | number | null;
  description: string;
};

export type AiSource = {
  provider: string;
  type: "internal_db" | "official_api" | "configured_feed" | "web";
  title: string;
  url?: string | null;
  retrieved_at: string;
  trust: "high" | "medium" | "low";
  note?: string | null;
};

export type AiConfidence = {
  score: number;
  label: string;
  rationale: string[];
};

export type AiEvidence = {
  verified: string[];
  inferred: string[];
  estimated: string[];
};

export type AiNarrative = {
  title: string;
  assistant_message: string;
  highlights: string[];
  insight_cards: AiInsightCard[];
  confidence: AiConfidence;
  evidence: AiEvidence;
  sources: AiSource[];
  caveats: string[];
  freshness_note?: string | null;
};

export type AiRecommendationLink = {
  vehicle_id?: number | null;
  display_name: string;
  detail_page_url?: string | null;
  related_listings_url?: string | null;
  related_listing_ids?: number[];
  related_listings_count?: number;
  fallback_search_url?: string | null;
  match_confidence?: number | null;
  match_label?: string | null;
};

export type AiActionPath = {
  type: string;
  label: string;
  url: string;
  note?: string | null;
  match_confidence?: number | null;
  related_listing_ids?: number[];
};

export type AiSuggestedAction = {
  type: string;
  payload?: Record<string, unknown>;
};

export type AiPageIntelligenceSection = {
  key: string;
  title: string;
  assistant_message: string;
  highlights: string[];
  insight_cards: AiInsightCard[];
  confidence?: AiConfidence | null;
  caveats?: string[];
  sources?: AiSource[];
  freshness_note?: string | null;
  action_paths?: AiActionPath[];
};

export type AiPageIntelligenceResponse = {
  subject: {
    kind: "variant" | "listing";
    variant_id?: number;
    listing_id?: number;
    market_id: number;
    label: string;
    profile_snapshot?: string | null;
  };
  sections: AiPageIntelligenceSection[];
  recommendation_paths: AiRecommendationLink[];
};

export type AiCompareItem = {
  variant_id: number;
  make: string;
  model: string;
  year: number;
  trim: string;
  body_type: string | null;
  fuel_type: string | null;
  engine: string | null;
  transmission: string | null;
  drivetrain: string | null;
  seats: number | null;
  doors: number | null;
  msrp_base: number | null;
  latest_price: number | null;
  avg_rating: number | null;
  review_count: number;
  pros: string[];
  cons: string[];
  scores: {
    rating_score: number;
    price_score: number;
    practicality_score: number;
    final_score: number;
  };
};

export type AiCompareResponse = AiNarrative & {
  items: AiCompareItem[];
  comparison_table: Record<string, Record<string, unknown>>;
  recommended_variant_id: number | null;
  recommendation_reason: string | null;
  notes?: string;
};

export type AiPredictResponse = AiNarrative & {
  variant_id: number;
  market_id: number;
  currency: string;
  price_type: string;
  history_points: number;
  last_price: number | null;
  horizon_months: number;
  predicted_price: number | null;
  predicted_min: number | null;
  predicted_max: number | null;
  trend_slope: number | null;
  volatility: number | null;
  confidence_score: number;
  prediction_mode: string;
  notes?: string;
};

export type AiTcoResponse = AiNarrative & {
  profile_id: number;
  profile_name: string;
  market_id: number;
  market_name: string | null;
  currency: string;
  currency_symbol: string;
  base_price: number;
  ownership_years: number;
  km_per_year: number;
  costs: {
    registration_tax: number | null;
    excise_tax: number | null;
    vat: number | null;
    import_duty: number | null;
    insurance_total: number | null;
    maintenance_total: number | null;
    depreciation_total: number | null;
    other: number | null;
  };
  yearly_breakdown: Record<string, number>;
  total_cost: number;
  yearly_cost_avg: number;
  rules_applied: Array<Record<string, unknown>>;
  notes?: string;
};

export type CatalogOwnershipSummary = {
  variant_id: number;
  market_id: number;
  ownership_years: number;
  base_price_source: string;
  estimate: AiTcoResponse;
};

export type Listing = {
  listing_id: number;
  owner_id: number;
  variant_id: number;
  asking_price: number;
  mileage_km?: number | null;
  location_city?: string | null;
  location_country_code?: string | null;
  description?: string | null;
  status: string;
  created_at?: string;
  title?: string | null;
  model_year?: number | null;
  trim_name?: string | null;
  body_type?: string | null;
  fuel_type?: string | null;
  transmission?: string | null;
  engine?: string | null;
  make_name?: string | null;
  model_name?: string | null;
  seller_type?: string | null;
  photo_source?: "listing" | "catalog" | "none" | null;
  image_count?: number;
  cover_image?: string | null;
  thumbnail?: string | null;
  images?: string[];
};

export type ListingImage = {
  listing_id?: number | null;
  listing_image_id?: number | null;
  url?: string | null;
  mimeType?: string | null;
  size?: number | null;
  fileName?: string | null;
  sortOrder?: number | null;
  storage?: string | null;
  createdAt?: string | null;
};

export type ListingDetail = {
  listing: Listing;
  images: ListingImage[];
};

export type NotificationItem = {
  notification_id: number;
  user_id: number;
  status: string;
  title?: string | null;
  body?: string | null;
  created_at?: string;
  read_at?: string | null;
};

export type ViewingRequest = {
  request_id: number;
  listing_id: number;
  buyer_id: number;
  seller_user_id?: number | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  preferred_viewing_time?: string | null;
  message?: string | null;
  status: string;
  created_at?: string;
  notified_at?: string | null;
};

export type WatchVariantItem = {
  user_id: number;
  variant_id: number;
};

export type WatchListingItem = {
  user_id: number;
  listing_id: number;
};

export type CarReview = {
  car_review_id?: number;
  user_id?: number;
  variant_id: number;
  rating: number;
  title?: string | null;
  comment?: string | null;
  created_at?: string;
};

export type SellerReview = {
  seller_review_id?: number;
  seller_id: number;
  buyer_id?: number;
  listing_id?: number | null;
  rating: number;
  comment?: string | null;
  created_at?: string;
};

export type ChatResponse = {
  session_id: number;
  flow_id?: string | null;
  intent: string;
  answer: string;
  cards: AiInsightCard[];
  confidence?: AiConfidence | null;
  evidence?: AiEvidence | null;
  sources?: AiSource[];
  caveats?: string[];
  freshness_note?: string | null;
  advisor_profile: AdvisorProfile;
  suggested_actions: AiSuggestedAction[];
  follow_up_questions: string[];
  facts_used: Array<Record<string, unknown>>;
  market_id: number;
  needs_clarification?: boolean;
  structured_result?: Record<string, unknown> | null;
  meta?: {
    services_used: string[];
    sources_used: string[];
    fallback_used: boolean;
    latency_ms: number;
    route_service?: string | null;
    missing_fields?: string[];
  };
};
