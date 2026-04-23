-- CreateTable
CREATE TABLE "User" (
    "u_id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "auth_provider" TEXT NOT NULL DEFAULT 'local',
    "avatar_url" TEXT,
    "display_name" TEXT,
    "user_level" TEXT NOT NULL DEFAULT 'normal',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Product" (
    "p_id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "danger_level" INTEGER NOT NULL,
    "media_url" TEXT,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SKUItem" (
    "s_id" TEXT NOT NULL PRIMARY KEY,
    "p_id" TEXT NOT NULL,
    "spec" TEXT NOT NULL,
    "price_knut" DECIMAL NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "stock_reserved" INTEGER NOT NULL DEFAULT 0,
    "weight_g" INTEGER,
    "image_url" TEXT,
    CONSTRAINT "SKUItem_p_id_fkey" FOREIGN KEY ("p_id") REFERENCES "Product" ("p_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Coupon" (
    "c_id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "discount_type" TEXT NOT NULL,
    "discount_value" DECIMAL NOT NULL,
    "min_spend_knut" DECIMAL NOT NULL DEFAULT 0,
    "max_uses" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" DATETIME,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Order" (
    "o_id" TEXT NOT NULL PRIMARY KEY,
    "u_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "total_knut" DECIMAL NOT NULL,
    "shipping_method" TEXT NOT NULL,
    "payment_method" TEXT NOT NULL,
    "tracking_number" TEXT,
    "shipping_address" TEXT NOT NULL,
    "is_ron" BOOLEAN NOT NULL DEFAULT false,
    "coupon_id" TEXT,
    "discount_snapshot" JSONB,
    "payment_id" TEXT,
    "final_captured_amount" DECIMAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Order_u_id_fkey" FOREIGN KEY ("u_id") REFERENCES "User" ("u_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "Coupon" ("c_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "oi_id" TEXT NOT NULL PRIMARY KEY,
    "o_id" TEXT NOT NULL,
    "s_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_knut" DECIMAL NOT NULL,
    "snapshot_name" TEXT NOT NULL DEFAULT '',
    "snapshot_spec" TEXT NOT NULL DEFAULT '',
    "snapshot_image_url" TEXT,
    CONSTRAINT "OrderItem_o_id_fkey" FOREIGN KEY ("o_id") REFERENCES "Order" ("o_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_s_id_fkey" FOREIGN KEY ("s_id") REFERENCES "SKUItem" ("s_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "log_id" TEXT NOT NULL PRIMARY KEY,
    "admin_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "payload" JSONB,
    "ip_address" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "User" ("u_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "prank_mode_enabled" BOOLEAN NOT NULL DEFAULT false,
    "howler_mode_enabled" BOOLEAN NOT NULL DEFAULT false,
    "peeves_patrol_active" BOOLEAN NOT NULL DEFAULT false,
    "mis_managed_active" BOOLEAN NOT NULL DEFAULT false,
    "price_random_min" REAL NOT NULL DEFAULT 0.5,
    "price_random_max" REAL NOT NULL DEFAULT 5.0,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SKUItem_p_id_spec_key" ON "SKUItem"("p_id", "spec");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");
