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
};

export type ListingDetail = {
  listing: Listing;
  images: Array<Record<string, unknown>>;
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
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  message?: string | null;
  status: string;
  created_at?: string;
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
  intent: string;
  answer: string;
  suggested_actions: Array<Record<string, unknown>>;
  follow_up_questions: string[];
  facts_used: Array<Record<string, unknown>>;
};
