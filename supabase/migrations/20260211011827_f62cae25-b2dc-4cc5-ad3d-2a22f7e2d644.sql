
-- Delete all auth users (this cascades and removes sessions, identities, etc.)
DELETE FROM auth.users;
