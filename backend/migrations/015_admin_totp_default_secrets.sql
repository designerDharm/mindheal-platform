-- Migration 015: Enforce Default Admin TOTP 2FA Secret
UPDATE users
SET totp_secret = 'JBSWY3DPEHPK3PXP', is_totp_enabled = TRUE
WHERE role = 'admin' AND (totp_secret IS NULL OR totp_secret = '');
