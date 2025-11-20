-- Script to manually add GIN index on product_variants.attributes
-- This is safe to run multiple times (IF NOT EXISTS prevents errors)

-- Add GIN index for efficient JSONB filtering on product_variants.attributes
-- This index enables fast queries on JSONB attributes for faceted search
-- (e.g., filtering by size, color, etc. stored in the attributes JSONB field)
CREATE INDEX IF NOT EXISTS product_variants_attributes_gin_idx 
ON product_variants USING GIN (attributes);

-- Verify the index was created
SELECT 
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    tablename = 'product_variants' 
    AND indexname = 'product_variants_attributes_gin_idx';

