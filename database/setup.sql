-- =====================================================
-- MDA CallCounter - Complete Database Setup Script
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Drop existing tables if they exist (for fresh start)
DROP TABLE IF EXISTS calls CASCADE;
DROP TABLE IF EXISTS motorcycle_info CASCADE;
DROP TABLE IF EXISTS call_types CASCADE;
DROP TABLE IF EXISTS daily_summaries CASCADE;

-- =====================================================
-- 1. Create call_types lookup table
-- =====================================================
CREATE TABLE call_types (
    id SERIAL PRIMARY KEY,
    type_key VARCHAR(50) UNIQUE NOT NULL,
    hebrew_name VARCHAR(100) NOT NULL,
    english_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert call types
INSERT INTO call_types (type_key, hebrew_name, english_name) VALUES
('urgent', 'דחוף', 'Urgent'),
('atan', 'אט"ן', 'ATaN'),
('aran', 'ארן', 'ARAN'),
('natbag', 'נתבג', 'Natbag');

-- =====================================================
-- 2. Create motorcycle_info table
-- =====================================================
CREATE TABLE motorcycle_info (
    id SERIAL PRIMARY KEY,
    motorcycle_number VARCHAR(10) UNIQUE NOT NULL,
    driver_name VARCHAR(100),
    phone VARCHAR(20),
    vehicle_type VARCHAR(20) DEFAULT 'motorcycle' CHECK (vehicle_type IN ('motorcycle', 'picanto', 'ambulance')),
    is_active BOOLEAN DEFAULT TRUE,
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert your motorcycle info
INSERT INTO motorcycle_info (motorcycle_number, driver_name, vehicle_type, is_active, is_current) VALUES
('5248', 'סהר מלול', 'motorcycle', TRUE, TRUE);

-- =====================================================
-- 3. Create main calls table
-- =====================================================
CREATE TABLE calls (
    id BIGSERIAL PRIMARY KEY,
    
    -- Call basic info
    call_type VARCHAR(50) NOT NULL REFERENCES call_types(type_key),
    call_number VARCHAR(20), -- Optional call reference number
    
    -- Time tracking
    start_time TIME NOT NULL,
    end_time TIME,
    call_date DATE NOT NULL DEFAULT CURRENT_DATE,
    duration_minutes INTEGER,
    
    -- Location and details
    location TEXT NOT NULL,
    destination TEXT, -- For transport calls
    description TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    
    -- Vehicle info (updated structure)
    vehicle_number VARCHAR(10) NOT NULL DEFAULT '5248',
    vehicle_type VARCHAR(20) NOT NULL DEFAULT 'motorcycle' CHECK (vehicle_type IN ('motorcycle', 'picanto', 'ambulance')),
    
    -- Patient info (optional)
    patient_count INTEGER DEFAULT 1,
    patient_condition VARCHAR(50), -- e.g., 'stable', 'critical', 'minor'
    
    -- Additional fields
    weather_conditions VARCHAR(50),
    traffic_conditions VARCHAR(50),
    special_notes TEXT,
    
    -- System fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_times CHECK (end_time IS NULL OR end_time >= start_time),
    CONSTRAINT valid_duration CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
    CONSTRAINT valid_patient_count CHECK (patient_count > 0)
);

-- =====================================================
-- 4. Create daily_summaries table for performance
-- =====================================================
CREATE TABLE daily_summaries (
    id SERIAL PRIMARY KEY,
    summary_date DATE NOT NULL,
    motorcycle_number VARCHAR(10) NOT NULL,
    
    -- Counts
    total_calls INTEGER DEFAULT 0,
    emergency_calls INTEGER DEFAULT 0,
    urgent_calls INTEGER DEFAULT 0,
    routine_calls INTEGER DEFAULT 0,
    transport_calls INTEGER DEFAULT 0,
    standby_calls INTEGER DEFAULT 0,
    
    -- Time tracking
    total_active_minutes INTEGER DEFAULT 0,
    total_hours DECIMAL(5,2) DEFAULT 0,
    first_call_time TIME,
    last_call_time TIME,
    
    -- Status counts
    completed_calls INTEGER DEFAULT 0,
    active_calls INTEGER DEFAULT 0,
    cancelled_calls INTEGER DEFAULT 0,
    
    -- System fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(summary_date, motorcycle_number)
);

-- =====================================================
-- 5. Create indexes for better performance
-- =====================================================
CREATE INDEX idx_calls_vehicle_date ON calls(vehicle_number, vehicle_type, call_date);
CREATE INDEX idx_calls_date_desc ON calls(call_date DESC);
CREATE INDEX idx_calls_type ON calls(call_type);
CREATE INDEX idx_calls_vehicle_type ON calls(vehicle_type);
CREATE INDEX idx_calls_vehicle_number ON calls(vehicle_number);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_start_time ON calls(start_time);
CREATE INDEX idx_calls_created_at ON calls(created_at DESC);

CREATE INDEX idx_daily_summaries_date ON daily_summaries(summary_date DESC);
CREATE INDEX idx_daily_summaries_motorcycle ON daily_summaries(motorcycle_number);

-- =====================================================
-- 6. Create functions
-- =====================================================

-- Function to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to calculate call duration
CREATE OR REPLACE FUNCTION calculate_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
        -- Calculate duration in minutes
        NEW.duration_minutes := EXTRACT(EPOCH FROM (
            NEW.call_date + NEW.end_time - (NEW.call_date + NEW.start_time)
        )) / 60;
        
        -- Set status to completed if it was active
        IF OLD.status = 'active' AND NEW.status = 'active' THEN
            NEW.status := 'completed';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to get current vehicle settings
CREATE OR REPLACE FUNCTION get_current_vehicle()
RETURNS TABLE (
    vehicle_number VARCHAR,
    vehicle_type VARCHAR,
    driver_name VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mi.motorcycle_number as vehicle_number,
        mi.vehicle_type,
        mi.driver_name
    FROM motorcycle_info mi
    WHERE mi.is_current = TRUE AND mi.is_active = TRUE
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to set current vehicle
CREATE OR REPLACE FUNCTION set_current_vehicle(new_vehicle_number VARCHAR, new_vehicle_type VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    -- Clear current flag from all vehicles
    UPDATE motorcycle_info SET is_current = FALSE WHERE is_current = TRUE;
    
    -- Set new current vehicle or insert if doesn't exist
    INSERT INTO motorcycle_info (motorcycle_number, vehicle_type, is_current, is_active)
    VALUES (new_vehicle_number, new_vehicle_type, TRUE, TRUE)
    ON CONFLICT (motorcycle_number) 
    DO UPDATE SET 
        vehicle_type = EXCLUDED.vehicle_type,
        is_current = TRUE,
        is_active = TRUE,
        updated_at = NOW();
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get today's statistics (00:00 to 23:59)
CREATE OR REPLACE FUNCTION get_today_stats(motorcycle_num VARCHAR DEFAULT NULL)
RETURNS TABLE (
    total_calls BIGINT,
    completed_calls BIGINT,
    active_calls BIGINT,
    cancelled_calls BIGINT,
    total_hours NUMERIC,
    current_status TEXT,
    emergency_calls BIGINT,
    urgent_calls BIGINT,
    first_call_time TIME,
    last_call_time TIME
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN c.status = 'completed' THEN 1 END) as completed_calls,
        COUNT(CASE WHEN c.status = 'active' THEN 1 END) as active_calls,
        COUNT(CASE WHEN c.status = 'cancelled' THEN 1 END) as cancelled_calls,
        ROUND(COALESCE(SUM(c.duration_minutes), 0)::numeric / 60, 2) as total_hours,
        CASE 
            WHEN COUNT(CASE WHEN c.status = 'active' THEN 1 END) > 0 THEN 'פעיל'
            ELSE 'זמין'
        END as current_status,
        COUNT(CASE WHEN c.call_type = 'emergency' THEN 1 END) as emergency_calls,
        COUNT(CASE WHEN c.call_type = 'urgent' THEN 1 END) as urgent_calls,
        MIN(c.start_time) as first_call_time,
        MAX(COALESCE(c.end_time, c.start_time)) as last_call_time
    FROM calls c
    WHERE c.call_date = CURRENT_DATE  -- Includes full day: 00:00:00 to 23:59:59
    AND c.vehicle_number = COALESCE(motorcycle_num, (SELECT vehicle_number FROM get_current_vehicle() LIMIT 1));
END;
$$ LANGUAGE plpgsql;

-- Function to get weekly statistics (Sunday to Saturday)
CREATE OR REPLACE FUNCTION get_weekly_stats(motorcycle_num VARCHAR DEFAULT NULL)
RETURNS TABLE (
    total_calls BIGINT,
    total_hours NUMERIC
) AS $$
DECLARE
    week_start DATE;
    week_end DATE;
BEGIN
    -- Calculate this week's Sunday to Saturday
    week_start := CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER;
    week_end := week_start + INTERVAL '6 days';
    
    RETURN QUERY
    SELECT 
        COUNT(*) as total_calls,
        ROUND(COALESCE(SUM(c.duration_minutes), 0)::numeric / 60, 2) as total_hours
    FROM calls c
    WHERE c.call_date >= week_start 
    AND c.call_date <= week_end
    AND c.vehicle_number = COALESCE(motorcycle_num, (SELECT vehicle_number FROM get_current_vehicle() LIMIT 1));
END;
$$ LANGUAGE plpgsql;

-- Function to get monthly statistics (1st to last day of month)
CREATE OR REPLACE FUNCTION get_monthly_stats(motorcycle_num VARCHAR DEFAULT NULL)
RETURNS TABLE (
    total_calls BIGINT,
    total_hours NUMERIC
) AS $$
DECLARE
    month_start DATE;
    month_end DATE;
BEGIN
    -- Calculate this month's 1st to last day
    month_start := DATE_TRUNC('month', CURRENT_DATE);
    month_end := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;
    
    RETURN QUERY
    SELECT 
        COUNT(*) as total_calls,
        ROUND(COALESCE(SUM(c.duration_minutes), 0)::numeric / 60, 2) as total_hours
    FROM calls c
    WHERE c.call_date >= month_start 
    AND c.call_date <= month_end
    AND c.vehicle_number = COALESCE(motorcycle_num, (SELECT vehicle_number FROM get_current_vehicle() LIMIT 1));
END;
$$ LANGUAGE plpgsql;

-- Function to update daily summary
CREATE OR REPLACE FUNCTION update_daily_summary()
RETURNS TRIGGER AS $$
DECLARE
    summary_exists BOOLEAN;
BEGIN
    -- Check if summary exists for today and this motorcycle
    SELECT EXISTS(
        SELECT 1 FROM daily_summaries 
        WHERE summary_date = CURRENT_DATE 
        AND motorcycle_number = COALESCE(NEW.vehicle_number, OLD.vehicle_number)
    ) INTO summary_exists;
    
    IF summary_exists THEN
        -- Update existing summary
        UPDATE daily_summaries SET
            total_calls = (SELECT COUNT(*) FROM calls WHERE call_date = CURRENT_DATE AND vehicle_number = COALESCE(NEW.vehicle_number, OLD.vehicle_number)),
            emergency_calls = (SELECT COUNT(*) FROM calls WHERE call_date = CURRENT_DATE AND vehicle_number = COALESCE(NEW.vehicle_number, OLD.vehicle_number) AND call_type = 'emergency'),
            urgent_calls = (SELECT COUNT(*) FROM calls WHERE call_date = CURRENT_DATE AND vehicle_number = COALESCE(NEW.vehicle_number, OLD.vehicle_number) AND call_type = 'urgent'),
            routine_calls = (SELECT COUNT(*) FROM calls WHERE call_date = CURRENT_DATE AND vehicle_number = COALESCE(NEW.vehicle_number, OLD.vehicle_number) AND call_type = 'routine'),
            transport_calls = (SELECT COUNT(*) FROM calls WHERE call_date = CURRENT_DATE AND vehicle_number = COALESCE(NEW.vehicle_number, OLD.vehicle_number) AND call_type = 'transport'),
            standby_calls = (SELECT COUNT(*) FROM calls WHERE call_date = CURRENT_DATE AND vehicle_number = COALESCE(NEW.vehicle_number, OLD.vehicle_number) AND call_type = 'standby'),
            completed_calls = (SELECT COUNT(*) FROM calls WHERE call_date = CURRENT_DATE AND vehicle_number = COALESCE(NEW.vehicle_number, OLD.vehicle_number) AND status = 'completed'),
            active_calls = (SELECT COUNT(*) FROM calls WHERE call_date = CURRENT_DATE AND vehicle_number = COALESCE(NEW.vehicle_number, OLD.vehicle_number) AND status = 'active'),
            cancelled_calls = (SELECT COUNT(*) FROM calls WHERE call_date = CURRENT_DATE AND vehicle_number = COALESCE(NEW.vehicle_number, OLD.vehicle_number) AND status = 'cancelled'),
            total_active_minutes = (SELECT COALESCE(SUM(duration_minutes), 0) FROM calls WHERE call_date = CURRENT_DATE AND vehicle_number = COALESCE(NEW.vehicle_number, OLD.vehicle_number)),
            total_hours = (SELECT ROUND(COALESCE(SUM(duration_minutes), 0)::numeric / 60, 2) FROM calls WHERE call_date = CURRENT_DATE AND vehicle_number = COALESCE(NEW.vehicle_number, OLD.vehicle_number)),
            first_call_time = (SELECT MIN(start_time) FROM calls WHERE call_date = CURRENT_DATE AND vehicle_number = COALESCE(NEW.vehicle_number, OLD.vehicle_number)),
            last_call_time = (SELECT MAX(COALESCE(end_time, start_time)) FROM calls WHERE call_date = CURRENT_DATE AND vehicle_number = COALESCE(NEW.vehicle_number, OLD.vehicle_number)),
            updated_at = NOW()
        WHERE summary_date = CURRENT_DATE 
        AND motorcycle_number = COALESCE(NEW.vehicle_number, OLD.vehicle_number);
    ELSE
        -- Insert new summary
        INSERT INTO daily_summaries (
            summary_date, motorcycle_number,
            total_calls, emergency_calls, urgent_calls, routine_calls, transport_calls, standby_calls,
            completed_calls, active_calls, cancelled_calls,
            total_active_minutes, total_hours, first_call_time, last_call_time
        )
        SELECT 
            CURRENT_DATE,
            COALESCE(NEW.vehicle_number, OLD.vehicle_number),
            COUNT(*),
            COUNT(CASE WHEN call_type = 'emergency' THEN 1 END),
            COUNT(CASE WHEN call_type = 'urgent' THEN 1 END),
            COUNT(CASE WHEN call_type = 'routine' THEN 1 END),
            COUNT(CASE WHEN call_type = 'transport' THEN 1 END),
            COUNT(CASE WHEN call_type = 'standby' THEN 1 END),
            COUNT(CASE WHEN status = 'completed' THEN 1 END),
            COUNT(CASE WHEN status = 'active' THEN 1 END),
            COUNT(CASE WHEN status = 'cancelled' THEN 1 END),
            COALESCE(SUM(duration_minutes), 0),
            ROUND(COALESCE(SUM(duration_minutes), 0)::numeric / 60, 2),
            MIN(start_time),
            MAX(COALESCE(end_time, start_time))
        FROM calls 
        WHERE call_date = CURRENT_DATE 
        AND vehicle_number = COALESCE(NEW.vehicle_number, OLD.vehicle_number);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. Create triggers
-- =====================================================

-- Trigger to automatically update updated_at on calls
CREATE TRIGGER update_calls_updated_at 
    BEFORE UPDATE ON calls 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at on motorcycle_info
CREATE TRIGGER update_motorcycle_info_updated_at 
    BEFORE UPDATE ON motorcycle_info 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at on daily_summaries
CREATE TRIGGER update_daily_summaries_updated_at 
    BEFORE UPDATE ON daily_summaries 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to calculate duration when end_time is set
CREATE TRIGGER calculate_call_duration
    BEFORE UPDATE ON calls
    FOR EACH ROW
    EXECUTE FUNCTION calculate_duration();

-- Trigger to update daily summary when calls change
CREATE TRIGGER update_daily_summary_on_insert
    AFTER INSERT ON calls
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_summary();

CREATE TRIGGER update_daily_summary_on_update
    AFTER UPDATE ON calls
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_summary();

CREATE TRIGGER update_daily_summary_on_delete
    AFTER DELETE ON calls
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_summary();

-- =====================================================
-- 8. Enable Row Level Security (RLS)
-- =====================================================
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE motorcycle_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations for authenticated and anonymous users
CREATE POLICY "Enable all operations for users" ON calls
    FOR ALL USING (true);

CREATE POLICY "Enable all operations for users" ON motorcycle_info
    FOR ALL USING (true);

CREATE POLICY "Enable all operations for users" ON call_types
    FOR ALL USING (true);

CREATE POLICY "Enable all operations for users" ON daily_summaries
    FOR ALL USING (true);

-- =====================================================
-- 9. Create views for easy querying
-- =====================================================

-- View for today's calls with Hebrew labels
CREATE OR REPLACE VIEW todays_calls AS
SELECT 
    c.id,
    c.call_number,
    ct.hebrew_name as call_type_hebrew,
    c.call_type,
    c.start_time,
    c.end_time,
    c.duration_minutes,
    CASE 
        WHEN c.duration_minutes IS NOT NULL THEN c.duration_minutes || ' דקות'
        ELSE 'בביצוע'
    END as duration_display,
    c.location,
    c.destination,
    c.description,
    CASE c.status
        WHEN 'active' THEN 'פעיל'
        WHEN 'completed' THEN 'הושלם'
        WHEN 'cancelled' THEN 'בוטל'
    END as status_hebrew,
    c.status,
    c.vehicle_number,
    c.vehicle_type,
    c.patient_count,
    c.patient_condition,
    c.weather_conditions,
    c.traffic_conditions,
    c.special_notes,
    c.created_at,
    c.updated_at
FROM calls c
JOIN call_types ct ON c.call_type = ct.type_key
WHERE c.call_date = CURRENT_DATE
ORDER BY c.created_at DESC;

-- View for motorcycle statistics
CREATE OR REPLACE VIEW motorcycle_stats AS
SELECT 
    ds.motorcycle_number,
    ds.summary_date,
    ds.total_calls,
    ds.emergency_calls,
    ds.urgent_calls,
    ds.routine_calls,
    ds.transport_calls,
    ds.standby_calls,
    ds.completed_calls,
    ds.active_calls,
    ds.cancelled_calls,
    ds.total_hours,
    ds.first_call_time,
    ds.last_call_time,
    mi.driver_name
FROM daily_summaries ds
LEFT JOIN motorcycle_info mi ON ds.motorcycle_number = mi.motorcycle_number
ORDER BY ds.summary_date DESC, ds.motorcycle_number;

-- =====================================================
-- Insert sample data for testing (optional - remove if not needed)
-- =====================================================
INSERT INTO calls (
    call_type, start_time, end_time, location, description, 
    vehicle_number, vehicle_type, call_date, duration_minutes, status
) VALUES
('urgent', '08:30:00', '09:15:00', 'רחוב הרצל 45, תל אביב', 'תאונת דרכים - פצוע קשה', '5248', 'motorcycle', CURRENT_DATE, 45, 'completed'),
('atan', '10:00:00', '10:30:00', 'בית חולים איכילוב', 'הובלת חולה לבדיקות', '1234', 'picanto', CURRENT_DATE, 30, 'completed'),
('aran', '14:20:00', '15:00:00', 'שדרות רוטשילד 120', 'חזיית לב - טיפול ויציבה', '7890', 'ambulance', CURRENT_DATE, 40, 'completed'),
('natbag', '16:00:00', NULL, 'בית חולים שיבא', 'הובלה דחופה לבית חולים', '5248', 'motorcycle', CURRENT_DATE, NULL, 'active');

-- =====================================================
-- SETUP COMPLETE!
-- =====================================================

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Display success message
SELECT 
    'MDA CallCounter Database Setup Complete!' as message,
    'Tables created: calls, motorcycle_info, call_types, daily_summaries' as tables,
    'Sample data inserted for motorcycle 5248' as sample_data,
    'Ready to use!' as status;