-- Migration: truck_closings table
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS truck_closings (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    "truckId" INTEGER NOT NULL,
    placa TEXT,
    mes INTEGER NOT NULL,
    ano INTEGER NOT NULL,
    "totalAbastecimento" NUMERIC DEFAULT 0,
    "totalFretes" NUMERIC DEFAULT 0,
    "totalMultas" NUMERIC DEFAULT 0,
    "totalDespesas" NUMERIC DEFAULT 0,
    "totalDespesasFixas" NUMERIC DEFAULT 0,
    "totalSalarioMotorista" NUMERIC DEFAULT 0,
    saldo NUMERIC DEFAULT 0,
    "mediaConsumo" NUMERIC DEFAULT 0,
    "totalLitros" NUMERIC DEFAULT 0,
    "totalKm" NUMERIC DEFAULT 0,
    "driverName" TEXT,
    "driverClosingId" INTEGER,
    "geradoEm" TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE truck_closings ENABLE ROW LEVEL SECURITY;

-- Policy: users can only access their own records
CREATE POLICY "Users can manage their own truck closings"
    ON truck_closings
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Function to auto-fill user_id on insert
CREATE OR REPLACE FUNCTION set_truck_closing_user_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_id IS NULL THEN
        NEW.user_id := auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER truck_closings_set_user_id
    BEFORE INSERT ON truck_closings
    FOR EACH ROW EXECUTE FUNCTION set_truck_closing_user_id();
