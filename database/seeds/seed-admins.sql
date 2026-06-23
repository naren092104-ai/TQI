-- Seed admin accounts for TQI
-- Use the backend seed script to generate bcrypt-hashed passwords.

INSERT INTO `admins` (`id`, `name`, `email`, `username`, `password`, `phone`, `role`, `active`, `lastLogin`, `createdAt`) VALUES
  ("demo-1", "Demo User", "demo@tqi.org", "demo", "<bcrypt-hash>", "9999999990", "Admin", true, NOW(), NOW()),
  ("admin-1", "Super Admin", "admin@tqi.org", "admin", "<bcrypt-hash>", "9999999999", "Super Admin", true, NOW(), NOW());

