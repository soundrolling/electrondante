-- Migration to add member associations to flights, expenses, documents, and parking
-- These typically have a single member associated (one-to-many)

-- Add member_email column to travel_flights
ALTER TABLE travel_flights
ADD COLUMN IF NOT EXISTS member_email TEXT;

CREATE INDEX IF NOT EXISTS idx_travel_flights_member_email ON travel_flights(member_email);

-- Add member_email column to travel_expenses
ALTER TABLE travel_expenses
ADD COLUMN IF NOT EXISTS member_email TEXT;

CREATE INDEX IF NOT EXISTS idx_travel_expenses_member_email ON travel_expenses(member_email);

-- Add member_email column to travel_documents
ALTER TABLE travel_documents
ADD COLUMN IF NOT EXISTS member_email TEXT;

CREATE INDEX IF NOT EXISTS idx_travel_documents_member_email ON travel_documents(member_email);

-- Add member_email column to travel_parking
ALTER TABLE travel_parking
ADD COLUMN IF NOT EXISTS member_email TEXT;

CREATE INDEX IF NOT EXISTS idx_travel_parking_member_email ON travel_parking(member_email);

