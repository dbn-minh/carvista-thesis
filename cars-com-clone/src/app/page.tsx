import React from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import PopularCategories from "@/components/home/PopularCategories";
import FeaturedEVs from "@/components/home/FeaturedEVs";
import NewsSection from "@/components/home/NewsSection";
import AutoTariffsSection from "@/components/home/AutoTariffsSection";
import CookieConsent from "@/components/shared/CookieConsent";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <PopularCategories />
        <AutoTariffsSection />
        <FeaturedEVs />
        <NewsSection />
      </main>
      <Footer />
      <CookieConsent />
    </>
  );
}
