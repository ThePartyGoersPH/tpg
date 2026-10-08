-- The Bar Registration form no longer collects a business description or an
-- owner password. business_description is already NULL-able; owner_password was
-- NOT NULL, so relax it to match the new submission rules (the public
-- /register-business flow still writes both columns when it has them).

ALTER TABLE business_registrations
  MODIFY owner_password varchar(255) NULL DEFAULT NULL;
