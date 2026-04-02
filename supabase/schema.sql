create table if not exists customers (
  customer_id bigint primary key,
  full_name text not null,
  email text not null,
  gender text not null,
  birthdate text not null,
  created_at text not null,
  city text,
  state text,
  zip_code text,
  customer_segment text,
  loyalty_tier text,
  is_active integer not null default 1
);

create table if not exists products (
  product_id bigint primary key,
  sku text not null,
  product_name text not null,
  category text not null,
  price numeric not null,
  cost numeric not null,
  is_active integer not null default 1
);

create table if not exists orders (
  order_id bigint primary key,
  customer_id bigint not null references customers(customer_id),
  order_datetime text not null,
  billing_zip text,
  shipping_zip text,
  shipping_state text,
  payment_method text not null,
  device_type text not null,
  ip_country text not null,
  promo_used integer not null default 0,
  promo_code text,
  order_subtotal numeric not null,
  shipping_fee numeric not null,
  tax_amount numeric not null,
  order_total numeric not null,
  risk_score numeric not null,
  is_fraud integer not null default 0
);

create table if not exists order_items (
  order_item_id bigint primary key,
  order_id bigint not null references orders(order_id),
  product_id bigint not null references products(product_id),
  quantity integer not null,
  unit_price numeric not null,
  line_total numeric not null
);

create table if not exists order_predictions (
  order_id bigint primary key references orders(order_id),
  late_delivery_probability numeric not null,
  predicted_late_delivery integer not null,
  prediction_timestamp text not null
);

create index if not exists idx_orders_customer_id on orders(customer_id);
create index if not exists idx_order_items_order_id on order_items(order_id);
