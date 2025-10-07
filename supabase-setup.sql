-- MDA Call Counter Database Setup
-- Copy and paste this entire SQL into your Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create call_types enum
CREATE TYPE call_type AS ENUM ('דחוף', 'אט"ן', 'ארן', 'נתבג');

-- Create vehicle_type enum  
CREATE TYPE vehicle_type AS ENUM ('אופנוע', 'פיקנטו', 'אמבולנס');

-- Create calls table
CREATE TABLE IF NOT EXISTS calls (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    call_type call_type NOT NULL,
    location TEXT NOT NULL,
    description TEXT,
    destination TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create vehicle_settings table
CREATE TABLE IF NOT EXISTS vehicle_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    vehicle_number TEXT NOT NULL,
    vehicle_type vehicle_type NOT NULL,
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create daily_call_summary table for statistics
CREATE TABLE IF NOT EXISTS daily_call_summary (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_calls INTEGER DEFAULT 0,
    urgent_calls INTEGER DEFAULT 0,
    atan_calls INTEGER DEFAULT 0,
    aren_calls INTEGER DEFAULT 0,
    netabag_calls INTEGER DEFAULT 0,
    total_hours DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date)
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_calls_updated_at BEFORE UPDATE ON calls 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicle_settings_updated_at BEFORE UPDATE ON vehicle_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_call_summary_updated_at BEFORE UPDATE ON daily_call_summary 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to set current vehicle
CREATE OR REPLACE FUNCTION set_current_vehicle(
    p_vehicle_number TEXT,
    p_vehicle_type vehicle_type
) RETURNS UUID AS $$
DECLARE
    vehicle_id UUID;
BEGIN
    -- Set all vehicles to not current
    UPDATE vehicle_settings SET is_current = FALSE WHERE is_current = TRUE;
    
    -- Check if vehicle already exists
    SELECT id INTO vehicle_id 
    FROM vehicle_settings 
    WHERE vehicle_number = p_vehicle_number AND vehicle_type = p_vehicle_type;
    
    IF vehicle_id IS NULL THEN
        -- Insert new vehicle
        INSERT INTO vehicle_settings (vehicle_number, vehicle_type, is_current)
        VALUES (p_vehicle_number, p_vehicle_type, TRUE)
        RETURNING id INTO vehicle_id;
    ELSE
        -- Update existing vehicle to current
        UPDATE vehicle_settings 
        SET is_current = TRUE, updated_at = NOW()
        WHERE id = vehicle_id;
    END IF;
    
    RETURN vehicle_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get weekly stats
CREATE OR REPLACE FUNCTION get_weekly_stats()
RETURNS TABLE(
    total_calls BIGINT,
    total_hours NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(COUNT(c.id), 0) as total_calls,
        COALESCE(ROUND(COUNT(c.id) * 0.5, 2), 0) as total_hours
    FROM calls c
    WHERE c.created_at >= DATE_TRUNC('week', NOW())
    AND c.created_at < DATE_TRUNC('week', NOW()) + INTERVAL '1 week';
END;
$$ LANGUAGE plpgsql;

-- Function to get monthly stats  
CREATE OR REPLACE FUNCTION get_monthly_stats()
RETURNS TABLE(
    total_calls BIGINT,
    total_hours NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(COUNT(c.id), 0) as total_calls,
        COALESCE(ROUND(COUNT(c.id) * 0.5, 2), 0) as total_hours
    FROM calls c
    WHERE c.created_at >= DATE_TRUNC('month', NOW())
    AND c.created_at < DATE_TRUNC('month', NOW()) + INTERVAL '1 month';
END;
$$ LANGUAGE plpgsql;

-- Insert default vehicle
INSERT INTO vehicle_settings (vehicle_number, vehicle_type, is_current)
VALUES ('5248', 'אופנוע', TRUE)
ON CONFLICT DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_call_summary ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust as needed for your security requirements)
CREATE POLICY "Enable all operations for calls" ON calls FOR ALL USING (true);
CREATE POLICY "Enable all operations for vehicle_settings" ON vehicle_settings FOR ALL USING (true);
CREATE POLICY "Enable all operations for daily_call_summary" ON daily_call_summary FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at);
CREATE INDEX IF NOT EXISTS idx_calls_call_type ON calls(call_type);
CREATE INDEX IF NOT EXISTS idx_vehicle_settings_current ON vehicle_settings(is_current);
CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON daily_call_summary(date);