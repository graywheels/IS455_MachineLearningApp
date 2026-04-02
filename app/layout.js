import "./globals.css";
import NavLinks from "@/components/NavLinks";
import SelectedCustomerBanner from "@/components/SelectedCustomerBanner";

export const metadata = {
  title: "IS455 ML App",
  description: "Operational app on shop.db",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <header className="app-header">
            <h1>IS455 ML App</h1>
            <p className="muted-text">
              Follow the guided flow: select customer, place order, run scoring, then review the
              warehouse queue.
            </p>
          </header>
          <NavLinks />
          <SelectedCustomerBanner />
          {children}
        </div>
      </body>
    </html>
  );
}
