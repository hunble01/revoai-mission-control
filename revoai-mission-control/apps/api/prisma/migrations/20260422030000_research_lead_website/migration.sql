-- Add website column so Google Maps Places API's real website URI survives
-- into ResearchLead. Previously only sourceUrl (which held googleMapsUri)
-- was persisted, causing Lead.website to get a maps.google.com URL and
-- breaking downstream LLM website-enrichment.
ALTER TABLE "research_leads" ADD COLUMN "website" TEXT;
