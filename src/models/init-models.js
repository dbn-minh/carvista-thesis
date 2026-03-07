import _sequelize from "sequelize";
const DataTypes = _sequelize.DataTypes;
import _AiChatMessages from  "./ai_chat_messages.js";
import _AiChatSessions from  "./ai_chat_sessions.js";
import _CarMakes from  "./car_makes.js";
import _CarModels from  "./car_models.js";
import _CarReviews from  "./car_reviews.js";
import _CarVariants from  "./car_variants.js";
import _ListingImages from  "./listing_images.js";
import _ListingPriceHistory from  "./listing_price_history.js";
import _Listings from  "./listings.js";
import _Markets from  "./markets.js";
import _Notifications from  "./notifications.js";
import _Reports from  "./reports.js";
import _SavedListings from  "./saved_listings.js";
import _SavedLogs from  "./saved_logs.js";
import _SellerReviews from  "./seller_reviews.js";
import _TcoProfiles from  "./tco_profiles.js";
import _TcoRules from  "./tco_rules.js";
import _Users from  "./users.js";
import _VariantImages from  "./variant_images.js";
import _VariantPriceHistory from  "./variant_price_history.js";
import _VariantSpecKv from  "./variant_spec_kv.js";
import _VariantSpecs from  "./variant_specs.js";
import _ViewingRequests from  "./viewing_requests.js";
import _WatchedVariants from  "./watched_variants.js";

export default function initModels(sequelize) {
  const AiChatMessages = _AiChatMessages.init(sequelize, DataTypes);
  const AiChatSessions = _AiChatSessions.init(sequelize, DataTypes);
  const CarMakes = _CarMakes.init(sequelize, DataTypes);
  const CarModels = _CarModels.init(sequelize, DataTypes);
  const CarReviews = _CarReviews.init(sequelize, DataTypes);
  const CarVariants = _CarVariants.init(sequelize, DataTypes);
  const ListingImages = _ListingImages.init(sequelize, DataTypes);
  const ListingPriceHistory = _ListingPriceHistory.init(sequelize, DataTypes);
  const Listings = _Listings.init(sequelize, DataTypes);
  const Markets = _Markets.init(sequelize, DataTypes);
  const Notifications = _Notifications.init(sequelize, DataTypes);
  const Reports = _Reports.init(sequelize, DataTypes);
  const SavedListings = _SavedListings.init(sequelize, DataTypes);
  const SavedLogs = _SavedLogs.init(sequelize, DataTypes);
  const SellerReviews = _SellerReviews.init(sequelize, DataTypes);
  const TcoProfiles = _TcoProfiles.init(sequelize, DataTypes);
  const TcoRules = _TcoRules.init(sequelize, DataTypes);
  const Users = _Users.init(sequelize, DataTypes);
  const VariantImages = _VariantImages.init(sequelize, DataTypes);
  const VariantPriceHistory = _VariantPriceHistory.init(sequelize, DataTypes);
  const VariantSpecKv = _VariantSpecKv.init(sequelize, DataTypes);
  const VariantSpecs = _VariantSpecs.init(sequelize, DataTypes);
  const ViewingRequests = _ViewingRequests.init(sequelize, DataTypes);
  const WatchedVariants = _WatchedVariants.init(sequelize, DataTypes);

  CarVariants.belongsToMany(Users, { as: 'user_id_users_watched_variants', through: WatchedVariants, foreignKey: "variant_id", otherKey: "user_id" });
  Listings.belongsToMany(Users, { as: 'user_id_users', through: SavedListings, foreignKey: "listing_id", otherKey: "user_id" });
  Users.belongsToMany(CarVariants, { as: 'variant_id_car_variants', through: WatchedVariants, foreignKey: "user_id", otherKey: "variant_id" });
  Users.belongsToMany(Listings, { as: 'listing_id_listings', through: SavedListings, foreignKey: "user_id", otherKey: "listing_id" });
  AiChatMessages.belongsTo(AiChatSessions, { as: "session", foreignKey: "session_id"});
  AiChatSessions.hasMany(AiChatMessages, { as: "ai_chat_messages", foreignKey: "session_id"});
  CarModels.belongsTo(CarMakes, { as: "make", foreignKey: "make_id"});
  CarMakes.hasMany(CarModels, { as: "car_models", foreignKey: "make_id"});
  CarVariants.belongsTo(CarModels, { as: "model", foreignKey: "model_id"});
  CarModels.hasMany(CarVariants, { as: "car_variants", foreignKey: "model_id"});
  CarReviews.belongsTo(CarVariants, { as: "variant", foreignKey: "variant_id"});
  CarVariants.hasMany(CarReviews, { as: "car_reviews", foreignKey: "variant_id"});
  Listings.belongsTo(CarVariants, { as: "variant", foreignKey: "variant_id"});
  CarVariants.hasMany(Listings, { as: "listings", foreignKey: "variant_id"});
  VariantImages.belongsTo(CarVariants, { as: "variant", foreignKey: "variant_id"});
  CarVariants.hasMany(VariantImages, { as: "variant_images", foreignKey: "variant_id"});
  VariantPriceHistory.belongsTo(CarVariants, { as: "variant", foreignKey: "variant_id"});
  CarVariants.hasMany(VariantPriceHistory, { as: "variant_price_histories", foreignKey: "variant_id"});
  VariantSpecKv.belongsTo(CarVariants, { as: "variant", foreignKey: "variant_id"});
  CarVariants.hasMany(VariantSpecKv, { as: "variant_spec_kvs", foreignKey: "variant_id"});
  VariantSpecs.belongsTo(CarVariants, { as: "variant", foreignKey: "variant_id"});
  CarVariants.hasOne(VariantSpecs, { as: "variant_spec", foreignKey: "variant_id"});
  WatchedVariants.belongsTo(CarVariants, { as: "variant", foreignKey: "variant_id"});
  CarVariants.hasMany(WatchedVariants, { as: "watched_variants", foreignKey: "variant_id"});
  ListingImages.belongsTo(Listings, { as: "listing", foreignKey: "listing_id"});
  Listings.hasMany(ListingImages, { as: "listing_images", foreignKey: "listing_id"});
  ListingPriceHistory.belongsTo(Listings, { as: "listing", foreignKey: "listing_id"});
  Listings.hasMany(ListingPriceHistory, { as: "listing_price_histories", foreignKey: "listing_id"});
  SavedListings.belongsTo(Listings, { as: "listing", foreignKey: "listing_id"});
  Listings.hasMany(SavedListings, { as: "saved_listings", foreignKey: "listing_id"});
  SellerReviews.belongsTo(Listings, { as: "listing", foreignKey: "listing_id"});
  Listings.hasMany(SellerReviews, { as: "seller_reviews", foreignKey: "listing_id"});
  ViewingRequests.belongsTo(Listings, { as: "listing", foreignKey: "listing_id"});
  Listings.hasMany(ViewingRequests, { as: "viewing_requests", foreignKey: "listing_id"});
  TcoProfiles.belongsTo(Markets, { as: "market", foreignKey: "market_id"});
  Markets.hasMany(TcoProfiles, { as: "tco_profiles", foreignKey: "market_id"});
  VariantPriceHistory.belongsTo(Markets, { as: "market", foreignKey: "market_id"});
  Markets.hasMany(VariantPriceHistory, { as: "variant_price_histories", foreignKey: "market_id"});
  TcoRules.belongsTo(TcoProfiles, { as: "profile", foreignKey: "profile_id"});
  TcoProfiles.hasMany(TcoRules, { as: "tco_rules", foreignKey: "profile_id"});
  AiChatSessions.belongsTo(Users, { as: "user", foreignKey: "user_id"});
  Users.hasMany(AiChatSessions, { as: "ai_chat_sessions", foreignKey: "user_id"});
  CarReviews.belongsTo(Users, { as: "user", foreignKey: "user_id"});
  Users.hasMany(CarReviews, { as: "car_reviews", foreignKey: "user_id"});
  Listings.belongsTo(Users, { as: "owner", foreignKey: "owner_id"});
  Users.hasMany(Listings, { as: "listings", foreignKey: "owner_id"});
  Notifications.belongsTo(Users, { as: "user", foreignKey: "user_id"});
  Users.hasMany(Notifications, { as: "notifications", foreignKey: "user_id"});
  Reports.belongsTo(Users, { as: "reporter", foreignKey: "reporter_id"});
  Users.hasMany(Reports, { as: "reports", foreignKey: "reporter_id"});
  Reports.belongsTo(Users, { as: "resolved_by_user", foreignKey: "resolved_by"});
  Users.hasMany(Reports, { as: "resolved_by_reports", foreignKey: "resolved_by"});
  SavedListings.belongsTo(Users, { as: "user", foreignKey: "user_id"});
  Users.hasMany(SavedListings, { as: "saved_listings", foreignKey: "user_id"});
  SavedLogs.belongsTo(Users, { as: "user", foreignKey: "user_id"});
  Users.hasMany(SavedLogs, { as: "saved_logs", foreignKey: "user_id"});
  SellerReviews.belongsTo(Users, { as: "buyer", foreignKey: "buyer_id"});
  Users.hasMany(SellerReviews, { as: "seller_reviews", foreignKey: "buyer_id"});
  SellerReviews.belongsTo(Users, { as: "seller", foreignKey: "seller_id"});
  Users.hasMany(SellerReviews, { as: "seller_seller_reviews", foreignKey: "seller_id"});
  ViewingRequests.belongsTo(Users, { as: "buyer", foreignKey: "buyer_id"});
  Users.hasMany(ViewingRequests, { as: "viewing_requests", foreignKey: "buyer_id"});
  WatchedVariants.belongsTo(Users, { as: "user", foreignKey: "user_id"});
  Users.hasMany(WatchedVariants, { as: "watched_variants", foreignKey: "user_id"});

  return {
    AiChatMessages,
    AiChatSessions,
    CarMakes,
    CarModels,
    CarReviews,
    CarVariants,
    ListingImages,
    ListingPriceHistory,
    Listings,
    Markets,
    Notifications,
    Reports,
    SavedListings,
    SavedLogs,
    SellerReviews,
    TcoProfiles,
    TcoRules,
    Users,
    VariantImages,
    VariantPriceHistory,
    VariantSpecKv,
    VariantSpecs,
    ViewingRequests,
    WatchedVariants,
  };
}
