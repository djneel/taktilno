import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  customType,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/** bytea для хранения загруженных через админку файлов прямо в БД */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/* ---------- Категории ---------- */
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").default("").notNull(),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  showOnHome: boolean("show_on_home").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ---------- Товары ---------- */
export type ProductSpecifications = {
  size?: string;
  material?: string;
  weight?: string;
  color?: string;
  features?: string;
  [key: string]: string | undefined;
};

/** Задел под варианты (цвет/размер/цена) и скидки */
export type ProductVariant = {
  id: string;
  name: string;
  color?: string;
  size?: string;
  price?: number;
  stock?: number;
};

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    shortDescription: text("short_description").default("").notNull(),
    description: text("description").default("").notNull(),
    price: integer("price").notNull(), // в рублях
    oldPrice: integer("old_price"), // для скидок
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    specifications: jsonb("specifications")
      .$type<ProductSpecifications>()
      .default({})
      .notNull(),
    variants: jsonb("variants").$type<ProductVariant[]>().default([]).notNull(),
    stock: integer("stock").default(0).notNull(),
    isFeatured: boolean("is_featured").default(false).notNull(),
    isNew: boolean("is_new").default(false).notNull(),
    isAvailable: boolean("is_available").default(true).notNull(),
    popularity: integer("popularity").default(0).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("products_category_idx").on(t.categoryId)]
);

/* ---------- Изображения товаров ---------- */
export const IMAGE_KINDS = [
  "main",
  "front",
  "side",
  "back",
  "top",
  "detail",
  "hand",
  "lifestyle",
  "frame360",
] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

export const productImages = pgTable(
  "product_images",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    url: text("url").notNull(),
    kind: text("kind").$type<ImageKind>().default("main").notNull(),
    alt: text("alt").default("").notNull(),
    colorVariant: text("color_variant"),
    sortOrder: integer("sort_order").default(0).notNull(),
    mediaId: integer("media_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("product_images_product_idx").on(t.productId)]
);

/* ---------- Медиафайлы (загрузки из админки) ---------- */
export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ---------- Отзывы ---------- */
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  authorName: text("author_name").notNull(),
  text: text("text").notNull(),
  rating: integer("rating").default(5).notNull(),
  photoUrl: text("photo_url"),
  isVisible: boolean("is_visible").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ---------- Заказы ---------- */
export const ORDER_STATUSES = [
  "new",
  "paid",
  "processing",
  "shipped",
  "completed",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(), // ТАК-XXXX
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  city: text("city").notNull(),
  deliveryMethod: text("delivery_method").notNull(),
  address: text("address").default("").notNull(),
  comment: text("comment").default("").notNull(),
  subtotal: integer("subtotal").notNull(),
  deliveryCost: integer("delivery_cost").default(0).notNull(),
  total: integer("total").notNull(),
  status: text("status").$type<OrderStatus>().default("new").notNull(),
  paymentStatus: text("payment_status")
    .$type<PaymentStatus>()
    .default("pending")
    .notNull(),
  paymentProvider: text("payment_provider").default("none").notNull(),
  paymentId: text("payment_id"),
  paymentUrl: text("payment_url"),
  promoCode: text("promo_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .references(() => orders.id, { onDelete: "cascade" })
    .notNull(),
  productId: integer("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  price: integer("price").notNull(),
  quantity: integer("quantity").notNull(),
  imageUrl: text("image_url"),
});

/* ---------- Настройки сайта (hero-изображение, блок 360 и т.д.) ---------- */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").default("").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* ---------- Relations ---------- */
export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  images: many(productImages),
  reviews: many(reviews),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductImage = typeof productImages.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
