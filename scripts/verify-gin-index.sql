-- Script to verify GIN index exists on product_variants.attributes
-- Run this in your PostgreSQL database to check if the index is present

-- Check if the GIN index exists
SELECT 
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    tablename = 'product_variants' 
    AND indexname = 'product_variants_attributes_gin_idx';

-- If the above returns no rows, the index doesn't exist yet
-- You can create it manually with:
-- CREATE INDEX IF NOT EXISTS product_variants_attributes_gin_idx 
-- ON product_variants USING GIN (attributes);

