-- Exécuter dans Supabase SQL Editor si la migration 057 n'est pas encore appliquée

CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON contact_messages(created_at DESC);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_admin_read_contact_messages" ON contact_messages;
CREATE POLICY "platform_admin_read_contact_messages" ON contact_messages
  FOR SELECT USING (is_platform_admin());

COMMENT ON TABLE contact_messages IS 'Messages reçus via le formulaire contact public';
