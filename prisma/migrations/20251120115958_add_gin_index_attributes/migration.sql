-- Add GIN index for efficient JSONB filtering on product_variants.attributes
-- This index enables fast queries on JSONB attributes for faceted search
-- (e.g., filtering by size, color, etc. stored in the attributes JSONB field)
CREATE INDEX IF NOT EXISTS "product_variants_attributes_gin_idx" 
ON "product_variants" USING GIN ("attributes");

