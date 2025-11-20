# Clothing E-Commerce Schema Migration Guide

## Overview

This document describes the comprehensive schema updates to transform the e-commerce backend into a full-featured clothing e-commerce system.

## Migration Steps

### 1. Generate and Apply Migration

```bash
npm run prisma:migrate
```

This will create a new migration file with all the schema changes.

### 2. Add GIN Index for JSONB Attributes (Manual Step)

After the migration is applied, you need to manually add a GIN index on the `product_variants.attributes` JSONB field for efficient filtering. This cannot be done through Prisma schema directly.

Connect to the correct DB inside the Postgres container
Your compose used POSTGRES_DB=ecommerce_db. Connect to that DB:
docker exec -it ecommerce-postgres psql -U postgres -d ecommerce_db

(If your container name is different, replace ecommerce-postgres with the container name from docker ps.)

now you are in DB.   

Run this SQL command in your database:

```sql
-- Add GIN index for efficient JSONB filtering on product_variants.attributes
CREATE INDEX IF NOT EXISTS product_variants_attributes_gin_idx 
ON product_variants USING GIN (attributes);
```

Alternatively, you can add this to the migration SQL file manually before applying:

1. Find the generated migration file in `prisma/migrations/[timestamp]_[name]/migration.sql`
2. Add the GIN index creation at the end of the file:

```sql
-- CreateIndex (manual addition for JSONB filtering)
CREATE INDEX "product_variants_attributes_gin_idx" ON "product_variants" USING GIN ("attributes");
```

### 3. Verify Migration

After applying the migration:

```bash
npm run prisma:generate
npm run prisma:studio
```

## Schema Changes Summary

### New Models

1. **Category** - Hierarchical categories for product taxonomy
   - Self-referential parent-child relationship
   - Supports multi-level category trees

2. **Brand** - Clothing brands/manufacturers
   - Unique name and slug
   - Logo and website support

3. **Collection** - Seasonal collections, campaigns
   - Date range support (startDate, endDate)
   - Image/banner support

4. **ProductMedia** - Product gallery images
   - Multiple images per product
   - Primary image flag
   - Position/sort order

5. **VariantMedia** - Variant-specific images
   - Color swatches, size-specific images
   - Position/sort order

6. **Warehouse** - Physical warehouse locations
   - Warehouse codes
   - Address information

7. **InventoryStock** - Multi-warehouse inventory tracking
   - Stock per variant per warehouse
   - Reserved stock tracking
   - Reorder level support

8. **SizeChart** - Size measurements mapping
   - JSON structure for measurements
   - One per product

9. **Promotion** - Promo codes and discounts
   - Percentage, fixed amount, or free shipping
   - Usage limits and tracking
   - Category/brand applicability

10. **PriceHistory** - Price change audit trail
    - Tracks all price changes
    - Reason and changedBy tracking

11. **Supplier** - Supplier/vendor information
    - Contact details
    - Supplier codes

12. **ProductCost** - Supplier cost data
    - Cost price per variant
    - Margin calculation support

13. **OrderItem** - Order line items
    - Replaces JSON storage
    - Price snapshots at order time
    - Links to variants

14. **Return** - Return Merchandise Authorization (RMA)
    - Return status workflow
    - Return reasons
    - Refund tracking

15. **ReturnItem** - Individual items in returns
    - Links to order items and variants
    - Quantity and reason tracking

### Enhanced Models

#### Product
- Added `brandId`, `collectionId`, `gender` fields
- Added `status` (DRAFT, PUBLISHED, ARCHIVED)
- Added SEO fields: `metaTitle`, `metaDescription`
- Added soft delete: `isActive`, `deletedAt`
- Relations to Category, Brand, Collection, Media, SizeChart

#### ProductVariant
- Added `compareAtPrice` for showing discounts
- Added `isActive` flag
- Relations to InventoryStock, VariantMedia, OrderItem, PriceHistory, ReturnItem
- Note: `stock` field is deprecated in favor of InventoryStock (kept for backward compatibility)

#### Order
- Added `subtotalAmount`, `discountAmount`, `taxAmount`, `shippingAmount`
- Added `promotionCode` field
- Added `RETURNED` status
- Relations to OrderItem and Return

### New Enums

- **Gender**: MEN, WOMEN, UNISEX, KIDS, BOYS, GIRLS
- **ProductStatus**: DRAFT, PUBLISHED, ARCHIVED
- **ReturnStatus**: REQUESTED, APPROVED, REJECTED, PROCESSING, REFUNDED, COMPLETED, CANCELLED
- **ReturnReason**: DEFECTIVE, WRONG_SIZE, WRONG_ITEM, NOT_AS_DESCRIBED, CHANGED_MIND, OTHER

### Indexes Added

- Category: slug, parentId, isActive
- Brand: slug, isActive
- Collection: slug, isActive, startDate/endDate
- Product: brandId, collectionId, gender, status, isActive, deletedAt
- ProductVariant: isActive
- Order: promotionCode
- OrderItem: orderId, variantId, sku
- All new models have appropriate indexes

### Important Notes

1. **Backward Compatibility**: The `ProductVariant.stock` field is kept for backward compatibility but should be migrated to use `InventoryStock` for multi-warehouse support.

2. **GIN Index**: The GIN index on `product_variants.attributes` must be added manually via SQL as Prisma doesn't support GIN indexes directly in the schema.

3. **Migration Strategy**: 
   - New models can be added first
   - Existing Product.categoryId can be migrated to FK reference
   - Backfill brandId from existing product metadata if available
   - Gradually migrate to OrderItem model

4. **SKU Policy**: SKUs should follow the pattern: `BRAND-STYLE-COLOR-SIZE` (e.g., "NIKE-AIRMAX-BLACK-10")

5. **Search Integration**: For faceted search, consider syncing product data to external search engine (Elasticsearch/Typesense) with fields: gender, categorySlug, brand, sizes[], colors[], price.

## Next Steps

After migration:

1. Update Product DTOs and services to support new fields
2. Create Category, Brand, Collection modules
3. Create Media module for image management
4. Update Inventory module for multi-warehouse support
5. Create Promotion module
6. Create Return/RMA module
7. Update Orders module to use OrderItem model
8. Update Search module for faceted search
9. Create SizeChart module
10. Create Supplier module

See the TODO list for detailed implementation tasks.

