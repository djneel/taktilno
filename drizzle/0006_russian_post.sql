ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "weight_grams" integer DEFAULT 150 NOT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "postcode" text DEFAULT '' NOT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_number" text;
