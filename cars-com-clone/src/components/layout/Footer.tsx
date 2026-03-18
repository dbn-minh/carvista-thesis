import type React from "react";
import Link from "next/link";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import { ChevronRight } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-white pt-8 pb-4">
      <div className="container-cars">
        {/* Footer Main Links Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div>
            <h3 className="text-sm font-apercu-bold text-cars-primary mb-4">
              Buying & Selling
            </h3>
            <ul className="space-y-2">
              <FooterLink href="/finance/" label="Financing" />
              <FooterLink href="/shopping/" label="Find a Car" />
              <FooterLink href="/dealers/buy/" label="Find a Dealer" />
              <FooterLink
                href="/sitemap/city-listings/"
                label="Listings by City"
              />
              <FooterLink href="/cpo/" label="Certified Pre-Owned" />
              <FooterLink
                href="/car-loan-calculator/"
                label="Car Payment Calculators"
              />
              <FooterLink href="/reviews/" label="Car Reviews & Ratings" />
              <FooterLink
                href="/research/compare/"
                label="Compare Side by Side"
              />
              <FooterLink href="/fraud-awareness/" label="Fraud Awareness" />
              <FooterLink href="/sell/" label="Sell Your Car" />
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-apercu-bold text-cars-primary mb-4">
              Explore Our Brand
            </h3>
            <ul className="space-y-2">
              <FooterLink
                href="https://www.newcars.com/"
                label="NewCars.com"
                external
              />
              <FooterLink
                href="https://www.dealerrater.com/"
                label="DealerRater"
                external
              />
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-apercu-bold text-cars-primary mb-4">
              For Dealer Partners
            </h3>
            <ul className="space-y-2">
              <FooterLink
                href="https://hub.carscommerce.inc/"
                label="Platform Log-In"
                external
              />
              <FooterLink
                href="https://www.carscommerce.inc/"
                label="Cars Commerce Overview"
                external
              />
              <FooterLink
                href="https://www.carscommerce.inc/marketplace/"
                label="Cars.com"
                external
              />
              <FooterLink
                href="https://www.carscommerce.inc/dealer-inspire/"
                label="Dealer Inspire"
                external
              />
              <FooterLink
                href="https://www.carscommerce.inc/accutrade/"
                label="AccuTrade"
                external
              />
              <FooterLink
                href="https://www.carscommerce.inc/media-network/"
                label="Cars Commerce Media Network"
                external
              />
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-apercu-bold text-cars-primary mb-4">
              Our Company
            </h3>
            <ul className="space-y-2">
              <FooterLink href="/about/" label="About Cars.com" />
              <FooterLink href="/contact/" label="Contact Cars.com" />
              <FooterLink
                href="https://investor.cars.com/overview/default.aspx"
                label="Investor Relations"
                external
              />
              <FooterLink href="/careers/" label="Careers" />
              <FooterLink
                href="https://info.wrightsmedia.com/cars-licensing-reprints"
                label="Licensing & Reprints"
                external
              />
              <FooterLink href="/sitemap/" label="Site Map" />
            </ul>
          </div>
        </div>

        {/* Mobile App Links */}
        <div className="mb-8">
          <h3 className="text-sm font-apercu-bold text-cars-primary mb-4">
            Our Mobile App
          </h3>
          <div className="flex space-x-4">
            <Link
              href="https://apps.apple.com/us/app/cars-com-new-used-cars/id353263352"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src="https://ext.same-assets.com/569242764/207591330.webp"
                alt="Download on the App Store"
                width={120}
                height={40}
              />
            </Link>
            <Link
              href="https://play.google.com/store/apps/details?id=com.cars.android&hl=en_US"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src="https://ext.same-assets.com/569242764/2621382653.webp"
                alt="Get it on Google Play"
                width={120}
                height={40}
              />
            </Link>
          </div>
        </div>

        {/* Social Media Links */}
        <div className="mb-8">
          <h3 className="text-sm font-apercu-bold text-cars-primary mb-4">
            Connect With Us
          </h3>
          <div className="flex space-x-4">
            <SocialLink
              href="https://www.tiktok.com/@carsdotcom"
              icon="tiktok"
            />
            <SocialLink
              href="https://www.facebook.com/CarsDotCom/"
              icon="facebook"
            />
            <SocialLink
              href="https://www.youtube.com/user/Carscom/"
              icon="youtube"
            />
            <SocialLink
              href="https://www.instagram.com/carsdotcom/"
              icon="instagram"
            />
            <SocialLink
              href="https://www.pinterest.com/carsdotcom/"
              icon="pinterest"
            />
          </div>
        </div>

        {/* Legal Links */}
        <Separator className="mb-4" />
        <div className="flex flex-wrap justify-start gap-4 text-xs text-cars-primary mb-4">
          <Link
            href="/about/terms/"
            className="hover:text-cars-accent transition-colors"
          >
            Terms & Conditions of Use
          </Link>
          <Link
            href="/about/privacy/"
            className="hover:text-cars-accent transition-colors"
          >
            Privacy Notice
          </Link>
          <Link
            href="/about/ccpa-privacy-notice/"
            className="hover:text-cars-accent transition-colors"
          >
            California Privacy Notice
          </Link>
          <Link
            href="/about/ccpa-privacy-notice/#exercising-access-use-limitation-data-portability-deletion-and-correction-rights"
            className="hover:text-cars-accent transition-colors"
          >
            My Privacy Choices
          </Link>
          <button className="hover:text-cars-accent transition-colors">
            Cookie Preferences
          </button>
          <Link
            href="/about/accessibility/"
            className="hover:text-cars-accent transition-colors"
          >
            Accessibility Statement
          </Link>
          <Link
            href="/about/ad-choices/"
            className="hover:text-cars-accent transition-colors"
          >
            Ad Choices
          </Link>
        </div>

        {/* Copyright */}
        <p className="text-xs text-cars-primary">
          © 2025 Cars.com. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

type FooterLinkProps = {
  href: string;
  label: string;
  external?: boolean;
};

const FooterLink: React.FC<FooterLinkProps> = ({ href, label, external }) => {
  return (
    <li>
      <Link
        href={href}
        target={external ? "_blank" : "_self"}
        rel={external ? "noopener noreferrer" : ""}
        className="text-sm text-cars-primary hover:text-cars-accent transition-colors flex items-center"
      >
        {label}
        {external && <ChevronRight className="ml-1 h-3 w-3" />}
      </Link>
    </li>
  );
};

type SocialLinkProps = {
  href: string;
  icon: "tiktok" | "facebook" | "youtube" | "instagram" | "pinterest";
};

const SocialLink: React.FC<SocialLinkProps> = ({ href, icon }) => {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="w-8 h-8 rounded-full bg-cars-gray-light hover:bg-cars-accent transition-colors flex items-center justify-center"
    >
      {/* Icon SVGs would go here - simplified for now */}
      <span className="text-white text-xs">{icon.charAt(0).toUpperCase()}</span>
    </Link>
  );
};

export default Footer;
