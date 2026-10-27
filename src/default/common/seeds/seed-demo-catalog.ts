import { createHash } from "crypto";
import { AppDataSource } from "../../databases/mysql/migration.config";

type SellerRow = { id: string; storeName: string };
type AdminRow = { id: string };
type CategoryRow = { id: string; googleCategoryId: string | null };

type DemoProduct = {
  name: string;
  brand: string;
  categorySlug: string;
  gender: string;
  color: string;
  size: string;
  price: number;
  mrp: number;
  quantity: number;
  material: string;
};

const SEEDED_BY = "approved-demo-catalog-v1";
const DEFAULT_ASSET_BASE_URL = "https://placehold.co";

const products: DemoProduct[] = [
  {
    name: "Classic Cotton Crew Neck T-Shirt",
    brand: "Fashion Fizz Basics",
    categorySlug: "fashion-men-t-shirts",
    gender: "men",
    color: "Navy Blue",
    size: "M",
    price: 699,
    mrp: 999,
    quantity: 40,
    material: "100% cotton",
  },
  {
    name: "Slim Fit Everyday Shirt",
    brand: "Urban Loom",
    categorySlug: "fashion-men-shirts",
    gender: "men",
    color: "Sky Blue",
    size: "L",
    price: 1199,
    mrp: 1699,
    quantity: 32,
    material: "Cotton blend",
  },
  {
    name: "Straight Fit Stretch Jeans",
    brand: "Denim District",
    categorySlug: "fashion-men-jeans",
    gender: "men",
    color: "Indigo",
    size: "32",
    price: 1599,
    mrp: 2299,
    quantity: 26,
    material: "Stretch denim",
  },
  {
    name: "Floral Midi Dress",
    brand: "Ethereal Threads",
    categorySlug: "fashion-women-dresses",
    gender: "women",
    color: "Rose Pink",
    size: "M",
    price: 1899,
    mrp: 2699,
    quantity: 24,
    material: "Viscose rayon",
  },
  {
    name: "Embroidered A-Line Kurti",
    brand: "Rangriti Studio",
    categorySlug: "fashion-women-kurtas-kurtis",
    gender: "women",
    color: "Teal",
    size: "M",
    price: 1299,
    mrp: 1899,
    quantity: 30,
    material: "Cotton slub",
  },
  {
    name: "Soft Silk Festive Saree",
    brand: "Vastra Heritage",
    categorySlug: "fashion-women-sarees",
    gender: "women",
    color: "Maroon",
    size: "Free Size",
    price: 2499,
    mrp: 3499,
    quantity: 18,
    material: "Art silk",
  },
  {
    name: "Boys Graphic Cotton T-Shirt",
    brand: "Little Comet",
    categorySlug: "fashion-kids-boys-t-shirts",
    gender: "boys",
    color: "Yellow",
    size: "8-9Y",
    price: 499,
    mrp: 749,
    quantity: 35,
    material: "100% cotton",
  },
  {
    name: "Girls Party Fit and Flare Dress",
    brand: "Little Comet",
    categorySlug: "fashion-kids-girls-dresses-frocks",
    gender: "girls",
    color: "Lavender",
    size: "7-8Y",
    price: 1099,
    mrp: 1599,
    quantity: 22,
    material: "Polyester blend",
  },
  {
    name: "Air Flex Everyday Sneakers",
    brand: "Stride One",
    categorySlug: "shoes-men-sneakers",
    gender: "men",
    color: "White",
    size: "9",
    price: 2199,
    mrp: 3199,
    quantity: 28,
    material: "Synthetic upper and rubber sole",
  },
  {
    name: "Block Heel Comfort Sandals",
    brand: "Sole Story",
    categorySlug: "shoes-women-heels",
    gender: "women",
    color: "Tan",
    size: "6",
    price: 1499,
    mrp: 2199,
    quantity: 20,
    material: "Synthetic upper and cushioned sole",
  },
  {
    name: "Gold Plated Layered Necklace",
    brand: "Aurelia Jewels",
    categorySlug: "jewellery-necklaces",
    gender: "women",
    color: "Gold",
    size: "Free Size",
    price: 899,
    mrp: 1499,
    quantity: 45,
    material: "Gold-plated alloy",
  },
  {
    name: "Rose Gold Adjustable Ring",
    brand: "Aurelia Jewels",
    categorySlug: "jewellery-rings",
    gender: "women",
    color: "Rose Gold",
    size: "Adjustable",
    price: 599,
    mrp: 999,
    quantity: 50,
    material: "Rose-gold plated alloy",
  },
  {
    name: "Structured Everyday Handbag",
    brand: "Carry Culture",
    categorySlug: "accessories-handbags",
    gender: "women",
    color: "Black",
    size: "Medium",
    price: 1799,
    mrp: 2599,
    quantity: 21,
    material: "Premium vegan leather",
  },
  {
    name: "Citrus Bloom Eau de Parfum",
    brand: "Aura & Co",
    categorySlug: "beauty-perfumes",
    gender: "unisex",
    color: "Clear",
    size: "50 ml",
    price: 1299,
    mrp: 1799,
    quantity: 36,
    material: "Eau de parfum",
  },
  {
    name: "Daily Shield SPF 50 Sunscreen",
    brand: "Glow Theory",
    categorySlug: "beauty-sunscreen",
    gender: "unisex",
    color: "White",
    size: "50 g",
    price: 649,
    mrp: 799,
    quantity: 60,
    material: "Dermatologically tested gel",
  },
];

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function deterministicUuid(value: string): string {
  const digest = hash(value);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(
    17,
    20,
  )}-${digest.slice(20, 32)}`;
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function assetUrl(index: number, name: string): string {
  const configured = process.env.CATALOG_DEMO_ASSET_BASE_URL?.replace(
    /\/$/,
    "",
  );
  if (configured)
    return `${configured}/catalog/demo-product-${String(index).padStart(2, "0")}.jpg`;
  return `${DEFAULT_ASSET_BASE_URL}/800x1000/EEEAFB/312E81/png?text=${encodeURIComponent(name)}`;
}

async function seed(): Promise<void> {
  const environment = process.env.NODE_ENV || "development";
  if (
    environment === "production" &&
    process.env.ALLOW_CATALOG_DEMO_SEED !== "true"
  ) {
    throw new Error(
      "Demo catalogue seed is disabled in production. Set ALLOW_CATALOG_DEMO_SEED=true explicitly.",
    );
  }

  await AppDataSource.initialize();
  const runner = AppDataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();

  try {
    const requestedSellerId = process.env.CATALOG_DEMO_SELLER_ID?.trim();
    const sellerParams: string[] = [];
    const sellerFilter = requestedSellerId ? "AND seller.id = ?" : "";
    if (requestedSellerId) sellerParams.push(requestedSellerId);
    const sellers = (await runner.query(
      `SELECT seller.id, store.store_name AS storeName
       FROM users seller
       INNER JOIN user_roles user_role ON user_role.user_id = seller.id
       INNER JOIN roles role ON role.id = user_role.role_id AND role.name = 'seller_admin'
       INNER JOIN store_information store ON store.seller_id = seller.id
         AND store.deleted_at IS NULL AND store.onboarding_status = 'APPROVED'
       INNER JOIN seller_kyc_overrides kyc ON kyc.seller_id = seller.id
         AND kyc.deleted_at IS NULL AND kyc.status = 'APPROVED'
       WHERE seller.deleted_at IS NULL AND seller.status = 'active' ${sellerFilter}
         AND NOT EXISTS (
           SELECT 1 FROM account_role_states role_state
           WHERE role_state.user_id = seller.id AND role_state.role_name = 'seller_admin'
             AND role_state.status = 'SUSPENDED' AND role_state.deleted_at IS NULL
         )
       ORDER BY seller.id DESC LIMIT 1`,
      sellerParams,
    )) as SellerRow[];
    if (!sellers.length) {
      throw new Error(
        requestedSellerId
          ? `Seller ${requestedSellerId} is not active with approved profile and KYC.`
          : "No active seller with approved profile and KYC is available.",
      );
    }
    const seller = sellers[0];

    const admins = (await runner.query(
      `SELECT admin.id FROM users admin
       INNER JOIN user_roles user_role ON user_role.user_id = admin.id
       INNER JOIN roles role ON role.id = user_role.role_id AND role.name = 'super_admin'
       WHERE admin.deleted_at IS NULL AND admin.status = 'active'
       ORDER BY admin.id ASC LIMIT 1`,
    )) as AdminRow[];
    if (!admins.length)
      throw new Error(
        "An active super admin is required to approve demo products.",
      );
    const reviewerId = admins[0].id;

    const slugs = [...new Set(products.map((product) => product.categorySlug))];
    const categories = (await runner.query(
      `SELECT category.id, category.slug,
              CAST(mapping.google_category_id AS CHAR) AS googleCategoryId
       FROM categories category
       LEFT JOIN category_google_mappings mapping ON mapping.category_id = category.id
         AND mapping.is_primary = 1 AND mapping.active = 1 AND mapping.deleted_at IS NULL
       WHERE category.slug IN (${slugs.map(() => "?").join(",")})
         AND category.is_active = 1 AND category.status = 'APPROVED'
         AND category.deleted_at IS NULL`,
      slugs,
    )) as Array<CategoryRow & { slug: string }>;
    const categoryBySlug = new Map(
      categories.map((category) => [category.slug, category]),
    );
    const missingCategories = slugs.filter((slug) => !categoryBySlug.has(slug));
    if (missingCategories.length) {
      throw new Error(
        `Approved categories are missing: ${missingCategories.join(", ")}`,
      );
    }

    let insertedProducts = 0;
    let insertedVariants = 0;
    let insertedListings = 0;

    for (const [index, item] of products.entries()) {
      const sequence = String(index + 1).padStart(3, "0");
      const category = categoryBySlug.get(item.categorySlug)!;
      const productFingerprint = hash(`${SEEDED_BY}:product:${sequence}`);
      const variantFingerprint = hash(
        `${SEEDED_BY}:variant:${sequence}:${item.color}:${item.size}`,
      );
      const productCode = `FFD-${sequence}`;
      const sku = `FFD-${sequence}-${normalize(item.color).replace(/ /g, "-").toUpperCase()}-${normalize(item.size).replace(/ /g, "-").toUpperCase()}`;
      const discount = Number(
        (((item.mrp - item.price) / item.mrp) * 100).toFixed(2),
      );

      const existingProducts = await runner.query(
        "SELECT id FROM products WHERE product_fingerprint = ? LIMIT 1",
        [productFingerprint],
      );
      const isNewProduct = existingProducts.length === 0;
      await runner.query(
        `INSERT INTO products
          (submitted_by, category_id, google_product_category_id, name, short_description,
           description, highlights, material_and_fabric, care_instructions, attribute_values,
           base_price, mrp, discount_percentage, current_price, zone, status, reviewed_by,
           reviewed_at, product_fingerprint, product_code, normalized_name, normalized_brand,
           brand, gender)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RETAIL', 'APPROVED', ?,
                 UTC_TIMESTAMP(), ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE product_fingerprint = VALUES(product_fingerprint)`,
        [
          seller.id,
          category.id,
          category.googleCategoryId,
          item.name,
          `${item.name} by ${item.brand}`,
          `${item.name} designed for dependable everyday use. Sold by ${seller.storeName}.`,
          JSON.stringify(["Quality checked", "Ready to ship", "Easy returns"]),
          item.material,
          "Follow the care instructions printed on the product label.",
          JSON.stringify([{ key: "material", value: item.material }]),
          item.price,
          item.mrp,
          discount,
          item.price,
          reviewerId,
          productFingerprint,
          productCode,
          normalize(item.name),
          normalize(item.brand),
          item.brand,
          item.gender,
        ],
      );
      const productRows = await runner.query(
        "SELECT id FROM products WHERE product_fingerprint = ? LIMIT 1",
        [productFingerprint],
      );
      const productId = String(productRows[0].id);
      if (isNewProduct) {
        insertedProducts += 1;
        await runner.query(
          `INSERT INTO content_audits
            (resource_type, resource_id, actor_id, actor_role, action, changes)
           VALUES ('PRODUCT', ?, ?, 'super_admin', 'APPROVED', ?)`,
          [
            productId,
            reviewerId,
            JSON.stringify({
              seededBy: SEEDED_BY,
              sellerId: seller.id,
              status: "APPROVED",
            }),
          ],
        );
      }

      const existingVariants = await runner.query(
        "SELECT id FROM product_variants WHERE variant_fingerprint = ? LIMIT 1",
        [variantFingerprint],
      );
      const isNewVariant = existingVariants.length === 0;
      await runner.query(
        `INSERT INTO product_variants
          (product_id, attribute_values, size, sku, base_price, selling_price, mrp,
           discount_price, stock_quantity, variant_fingerprint, color, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED')
         ON DUPLICATE KEY UPDATE variant_fingerprint = VALUES(variant_fingerprint)`,
        [
          productId,
          JSON.stringify([
            { key: "color", value: item.color },
            { key: "size", value: item.size },
          ]),
          item.size,
          sku,
          item.price,
          item.price,
          item.mrp,
          item.price,
          item.quantity,
          variantFingerprint,
          item.color,
        ],
      );
      const variantRows = await runner.query(
        "SELECT id FROM product_variants WHERE variant_fingerprint = ? LIMIT 1",
        [variantFingerprint],
      );
      const variantId = String(variantRows[0].id);
      if (isNewVariant) insertedVariants += 1;

      const publicId = deterministicUuid(
        `${SEEDED_BY}:listing:${seller.id}:${sequence}`,
      );
      const sellerSku = `SELLER-${seller.id}-${sku}`;
      const existingListings = await runner.query(
        "SELECT id FROM seller_products WHERE seller_id = ? AND product_variant_id = ? LIMIT 1",
        [seller.id, variantId],
      );
      const isNewListing = existingListings.length === 0;
      await runner.query(
        `INSERT INTO seller_products
          (public_id, seller_id, seller_sku, product_variant_id, quantity, price, mrp, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
         ON DUPLICATE KEY UPDATE public_id = public_id`,
        [
          publicId,
          seller.id,
          sellerSku,
          variantId,
          item.quantity,
          item.price,
          item.mrp,
        ],
      );
      const listingRows = await runner.query(
        "SELECT id FROM seller_products WHERE seller_id = ? AND product_variant_id = ? LIMIT 1",
        [seller.id, variantId],
      );
      const listingId = String(listingRows[0].id);
      if (isNewListing) {
        insertedListings += 1;
        await runner.query(
          `INSERT INTO seller_product_audits (listing_id, actor_id, action, changes)
           VALUES (?, ?, 'DEMO_LISTING_ACTIVATED', ?)`,
          [
            listingId,
            reviewerId,
            JSON.stringify({
              seededBy: SEEDED_BY,
              status: "ACTIVE",
              quantity: item.quantity,
            }),
          ],
        );
      }

      const image = assetUrl(index + 1, item.name);
      const existingImages = await runner.query(
        "SELECT id FROM product_images WHERE product_id = ? AND url = ? LIMIT 1",
        [productId, image],
      );
      if (!existingImages.length) {
        await runner.query(
          `INSERT INTO product_images (product_id, variant_id, url, is_primary, sort_order)
           VALUES (?, ?, ?, 1, 0)`,
          [productId, variantId, image],
        );
      }
    }

    await runner.commitTransaction();
    process.stdout.write(
      `Demo catalogue ready for seller ${seller.id} (${seller.storeName}): ${products.length} approved products, ${products.length} approved variants and ${products.length} active listings. Newly inserted: ${insertedProducts}/${insertedVariants}/${insertedListings}.\n`,
    );
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
    await AppDataSource.destroy();
  }
}

void seed().catch((error: unknown) => {
  console.error(
    "Demo catalogue seed failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
