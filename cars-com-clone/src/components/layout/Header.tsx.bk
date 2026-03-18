import type React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

const Header = () => {
  return (
    <header className="w-full bg-white shadow-sm">
      <div className="container-cars py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <Image
                src="https://ext.same-assets.com/569242764/998758767.png"
                alt="Cars.com Logo"
                width={120}
                height={30}
                priority
              />
            </Link>

            {/* Main Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              <NavItem href="/shopping/" label="Cars for Sale" />
              <NavItem href="/new-cars/" label="New Cars" />
              <NavItem href="/research/" label="Research & Reviews" />
              <NavItem href="/news/" label="News & Videos" />
              <NavItem href="/sell/" label="Sell Your Car" />
              <NavItem href="/finance/" label="Financing" />
            </nav>
          </div>

          {/* Sign In */}
          <div className="flex items-center">
            <Link
              href="/signin"
              className="text-cars-primary text-sm font-apercu-regular hover:text-cars-accent transition-colors"
            >
              Sign In
            </Link>
            <div className="ml-2 w-6 h-6 flex items-center justify-center">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M18 6.5L6 6.5"
                  stroke="#3e3052"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M18 10L6 10"
                  stroke="#3e3052"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M18 13.5L6 13.5"
                  stroke="#3e3052"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M18 17L6 17"
                  stroke="#3e3052"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

type NavItemProps = {
  href: string;
  label: string;
};

const NavItem: React.FC<NavItemProps> = ({ href, label }) => {
  return (
    <Link
      href={href}
      className="text-cars-primary hover:text-cars-accent transition-colors font-apercu-regular text-sm"
    >
      {label}
    </Link>
  );
};

export default Header;
