import { AppDataSource } from "../../databases/mysql/migration.config";

type CategoryRow = { id: string; name: string; slug: string };
type ProductRow = { id: string };

const SEEDED_BY = "storefront-bootstrap-v1";
const DEFAULT_ASSET_BASE_URL = "https://placehold.co";

const categorySlugs = [
  "fashion",
  "fashion-men",
  "fashion-women",
  "fashion-kids",
  "shoes",
  "accessories",
  "jewellery",
  "beauty-personal-care",
] as const;

function assetUrl(
  fileName: string,
  width: number,
  height: number,
  label: string,
): string {
  const baseUrl = (
    process.env.STOREFRONT_SEED_ASSET_BASE_URL || DEFAULT_ASSET_BASE_URL
  ).replace(/\/$/, "");
  if (baseUrl === DEFAULT_ASSET_BASE_URL)
    return `${baseUrl}/${width}x${height}/EEEAFB/312E81/png?text=${encodeURIComponent(label)}`;
  return `${baseUrl}/storefront/${fileName}`;
}

async function seed(): Promise<void> {
  const environment = process.env.NODE_ENV || "development";
  if (
    environment === "production" &&
    process.env.ALLOW_STOREFRONT_SEED !== "true"
  ) {
    throw new Error(
      "Storefront seed is disabled in production. Set ALLOW_STOREFRONT_SEED=true.",
    );
  }

  await AppDataSource.initialize();
  const runner = AppDataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();

  try {
    const users = await runner.query(
      `SELECT id FROM users WHERE deleted_at IS NULL
       ORDER BY CASE WHEN username = 'superadmin' THEN 0 ELSE 1 END, id ASC LIMIT 1`,
    );
    if (!users.length)
      throw new Error(
        "A user is required before storefront content can be seeded.",
      );
    const actorId = String(users[0].id);

    const placeholders = categorySlugs.map(() => "?").join(",");
    const categories = (await runner.query(
      `SELECT id, name, slug FROM categories
       WHERE slug IN (${placeholders}) AND is_active = 1 AND status = 'APPROVED'
         AND deleted_at IS NULL`,
      [...categorySlugs],
    )) as CategoryRow[];
    const bySlug = new Map(
      categories.map((category) => [category.slug, category]),
    );
    const missing = categorySlugs.filter((slug) => !bySlug.has(slug));
    if (missing.length)
      throw new Error(
        `Required storefront categories are missing: ${missing.join(", ")}`,
      );

    for (const category of categories) {
      const url = assetUrl(
        `category-${category.slug}.png`,
        600,
        600,
        category.name,
      );
      await runner.query(
        `UPDATE categories SET image_url = ?
         WHERE id = ? AND (image_url IS NULL OR TRIM(image_url) = '')`,
        [url, category.id],
      );
    }

    const fashion = bySlug.get("fashion")!;
    const jewellery = bySlug.get("jewellery")!;
    const banners = [
      {
        id: "00000000-0000-4000-8000-000000000101",
        title: "Discover Your Style",
        subtitle: "Fresh fashion for every occasion",
        description: "Explore fashion from verified sellers.",
        desktop: assetUrl(
          "hero-fashion-desktop.png",
          1600,
          600,
          "Discover Your Style",
        ),
        mobile: assetUrl(
          "hero-fashion-mobile.png",
          750,
          900,
          "Discover Your Style",
        ),
        button: "Shop Fashion",
        actionValue: fashion.id,
        order: 10,
      },
      {
        id: "00000000-0000-4000-8000-000000000102",
        title: "Jewellery Collection",
        subtitle: "Complete every look",
        description: "Shop necklaces, rings, earrings and more.",
        desktop: assetUrl(
          "hero-jewellery-desktop.png",
          1600,
          600,
          "Jewellery Collection",
        ),
        mobile: assetUrl(
          "hero-jewellery-mobile.png",
          750,
          900,
          "Jewellery Collection",
        ),
        button: "Shop Jewellery",
        actionValue: jewellery.id,
        order: 20,
      },
    ];

    for (const banner of banners) {
      await runner.query(
        `INSERT INTO cms_banners
          (public_id, title, subtitle, description, desktop_image_url, mobile_image_url,
           button_text, action_type, action_value, placement, display_order, status,
           background_color, text_color, metadata, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'CATEGORY', ?, 'HOME_HERO', ?, 'ACTIVE',
                 '#EEEAFB', '#312E81', ?, ?, ?)
         ON DUPLICATE KEY UPDATE public_id = VALUES(public_id)`,
        [
          banner.id,
          banner.title,
          banner.subtitle,
          banner.description,
          banner.desktop,
          banner.mobile,
          banner.button,
          banner.actionValue,
          banner.order,
          JSON.stringify({ seededBy: SEEDED_BY }),
          actorId,
          actorId,
        ],
      );
    }

    await runner.query(
      `INSERT INTO cms_announcements
        (public_id, title, message, short_text, type, placement, priority, action_type,
         action_value, background_color, text_color, is_dismissible, display_order,
         status, created_by, updated_by)
       VALUES (?, 'Welcome to Fashion Fizz', 'Discover products from verified marketplace sellers.',
               'Shop new arrivals', 'NEW_FEATURE', 'HOME_TOP', 'NORMAL', 'SEARCH',
               'new arrivals', '#F5F3FF', '#312E81', 1, 10, 'ACTIVE', ?, ?)
       ON DUPLICATE KEY UPDATE public_id = VALUES(public_id)`,
      ["00000000-0000-4000-8000-000000000201", actorId, actorId],
    );

    const sections = [
      {
        id: "00000000-0000-4000-8000-000000000301",
        title: "Shop by Category",
        subtitle: "Find what you love",
        type: "CATEGORY_GRID",
        order: 10,
        categorySlugs: [
          "fashion",
          "shoes",
          "accessories",
          "jewellery",
          "beauty-personal-care",
        ],
      },
      {
        id: "00000000-0000-4000-8000-000000000302",
        title: "Fashion for Everyone",
        subtitle: "Men, women and kids",
        type: "CATEGORY_GRID",
        order: 20,
        categorySlugs: ["fashion-men", "fashion-women", "fashion-kids"],
      },
      {
        id: "00000000-0000-4000-8000-000000000303",
        title: "Featured Offers",
        subtitle: "Hand-picked collections",
        type: "BANNER_CAROUSEL",
        order: 30,
        bannerIds: banners.map((banner) => banner.id),
      },
    ];

    for (const section of sections) {
      await runner.query(
        `INSERT INTO cms_sections
          (public_id, title, subtitle, type, placement, content, display_order, status,
           created_by, updated_by)
         VALUES (?, ?, ?, ?, 'HOME', ?, ?, 'ACTIVE', ?, ?)
         ON DUPLICATE KEY UPDATE public_id = VALUES(public_id)`,
        [
          section.id,
          section.title,
          section.subtitle,
          section.type,
          JSON.stringify({ layout: "HORIZONTAL", seededBy: SEEDED_BY }),
          section.order,
          actorId,
          actorId,
        ],
      );
      const rows = await runner.query(
        "SELECT id FROM cms_sections WHERE public_id = ? LIMIT 1",
        [section.id],
      );
      const sectionId = String(rows[0].id);
      const references = section.categorySlugs
        ? section.categorySlugs.map((slug) => ({
            type: "CATEGORY",
            id: bySlug.get(slug)!.id,
          }))
        : (section.bannerIds ?? []).map((id) => ({ type: "BANNER", id }));
      for (const [index, reference] of references.entries()) {
        await runner.query(
          `INSERT INTO cms_section_items
            (section_id, item_type, reference_id, display_order, metadata)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE display_order = VALUES(display_order)`,
          [
            sectionId,
            reference.type,
            reference.id,
            (index + 1) * 10,
            JSON.stringify({ seededBy: SEEDED_BY }),
          ],
        );
      }
    }

    const products = (await runner.query(
      `SELECT DISTINCT product.id
       FROM products product
       INNER JOIN product_variants variant
         ON variant.product_id = product.id AND variant.deleted_at IS NULL
        AND variant.status = 'APPROVED'
       INNER JOIN seller_products listing
         ON listing.product_variant_id = variant.id AND listing.deleted_at IS NULL
        AND listing.status = 'ACTIVE' AND listing.quantity > 0
       WHERE product.deleted_at IS NULL AND product.status = 'APPROVED'
         AND product.product_fingerprint IS NOT NULL
       ORDER BY product.id DESC LIMIT 12`,
    )) as ProductRow[];

    if (products.length) {
      const sectionPublicId = "00000000-0000-4000-8000-000000000304";
      await runner.query(
        `INSERT INTO cms_sections
          (public_id, title, subtitle, type, placement, content, display_order, status,
           created_by, updated_by)
         VALUES (?, 'Trending Now', 'Popular products from our sellers', 'PRODUCT_COLLECTION',
                 'HOME', ?, 40, 'ACTIVE', ?, ?)
         ON DUPLICATE KEY UPDATE public_id = VALUES(public_id)`,
        [
          sectionPublicId,
          JSON.stringify({ layout: "HORIZONTAL", seededBy: SEEDED_BY }),
          actorId,
          actorId,
        ],
      );
      const sectionRows = await runner.query(
        "SELECT id FROM cms_sections WHERE public_id = ? LIMIT 1",
        [sectionPublicId],
      );
      for (const [index, product] of products.entries()) {
        await runner.query(
          `INSERT INTO cms_section_items
            (section_id, item_type, reference_id, display_order, metadata)
           VALUES (?, 'PRODUCT', ?, ?, ?)
           ON DUPLICATE KEY UPDATE display_order = VALUES(display_order)`,
          [
            String(sectionRows[0].id),
            product.id,
            (index + 1) * 10,
            JSON.stringify({ seededBy: SEEDED_BY }),
          ],
        );
      }
    }

    await runner.commitTransaction();
    process.stdout.write(
      `Storefront seed complete: ${banners.length} banners, 1 announcement, ${sections.length + (products.length ? 1 : 0)} sections, ${products.length} product references.\n`,
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
    "Storefront seed failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
