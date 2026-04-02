"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/select-customer", label: "Select Customer", step: 1 },
  { href: "/dashboard", label: "Review Dashboard", step: 2 },
  { href: "/place-order", label: "Place Order", step: 3 },
  { href: "/orders", label: "View Order History", step: 4 },
  { href: "/scoring", label: "Run Scoring", step: 5 },
  { href: "/warehouse/priority", label: "Check Priority Queue", step: 6 },
  { href: "/admin/orders", label: "Admin: All Orders", step: "★" },
];

export default function NavLinks() {
  const pathname = usePathname();

  const isActive = (href) => {
    if (href === "/orders") return pathname === "/orders" || pathname.startsWith("/orders/");
    return pathname === href;
  };

  return (
    <nav className="workflow-nav" aria-label="App workflow steps">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`workflow-link ${isActive(link.href) ? "active" : ""}`}
        >
          <span className="step-dot">{link.step}</span>
          <span>{link.label}</span>
        </Link>
      ))}
    </nav>
  );
}
