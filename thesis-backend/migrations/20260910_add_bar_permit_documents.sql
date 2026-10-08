-- Add required bar permit document paths for the owner registration flow.
ALTER TABLE business_registrations
  ADD COLUMN IF NOT EXISTS mayors_permit VARCHAR(500) DEFAULT NULL AFTER business_permit,
  ADD COLUMN IF NOT EXISTS sanitary_permit VARCHAR(500) DEFAULT NULL AFTER mayors_permit,
  ADD COLUMN IF NOT EXISTS fire_safety_certificate VARCHAR(500) DEFAULT NULL AFTER sanitary_permit,
  ADD COLUMN IF NOT EXISTS liquor_license VARCHAR(500) DEFAULT NULL AFTER fire_safety_certificate;
