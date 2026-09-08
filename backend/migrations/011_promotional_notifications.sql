CREATE TABLE promotional_banners (
  id varchar(255) PRIMARY KEY,
  message text NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);
