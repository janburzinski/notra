ALTER TABLE "google_search_console_integrations" ADD COLUMN "top_queries" jsonb DEFAULT '[]'::jsonb NOT NULL;
