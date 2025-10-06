-- Migration: Add missing columns to boat table
-- Date: 2025-10-06
-- Description: Add Features (JSONB), PrimaryImageUrl, SecondaryImageUrl, SideImageUrl, LogoImageUrl columns

-- Add the new columns to the boat table
ALTER TABLE boat 
ADD COLUMN IF NOT EXISTS features JSONB,
ADD COLUMN IF NOT EXISTS primary_image_url TEXT,
ADD COLUMN IF NOT EXISTS secondary_image_url TEXT,
ADD COLUMN IF NOT EXISTS side_image_url TEXT,
ADD COLUMN IF NOT EXISTS logo_image_url TEXT;

-- Add comments for documentation
COMMENT ON COLUMN boat.features IS 'JSON array of boat features and specifications';
COMMENT ON COLUMN boat.primary_image_url IS 'URL to the primary boat image';
COMMENT ON COLUMN boat.secondary_image_url IS 'URL to the secondary boat image';
COMMENT ON COLUMN boat.side_image_url IS 'URL to the side view boat image';
COMMENT ON COLUMN boat.logo_image_url IS 'URL to the boat logo/brand image';

-- Verify the columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'boat' 
  AND column_name IN ('features', 'primary_image_url', 'secondary_image_url', 'side_image_url', 'logo_image_url')
ORDER BY column_name;
