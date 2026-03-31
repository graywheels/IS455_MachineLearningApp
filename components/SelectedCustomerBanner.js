import { getSelectedCustomer } from "@/lib/customer";

export default async function SelectedCustomerBanner() {
  const customer = await getSelectedCustomer();

  if (!customer) {
    return (
      <div className="banner muted">
        No customer selected. Go to Select Customer to continue.
      </div>
    );
  }

  return (
    <div className="banner">
      Acting as customer #{customer.customer_id}: {customer.full_name} ({customer.email})
    </div>
  );
}
