// Migration script to fix timezone issues in historical call data
// This script recalculates call_date based on Israel timezone

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Check environment variables
if (!process.env.SUPABASE_URL) {
    console.error('❌ SUPABASE_URL not found in environment variables');
    process.exit(1);
}

if (!process.env.SUPABASE_ANON_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
    process.exit(1);
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Helper function to convert any date to Israel timezone
function toIsraelDate(dateString, timeString = '12:00') {
    try {
        // Handle null or undefined
        if (!dateString) return null;
        
        // Ensure time string is valid
        if (!timeString || timeString === 'null' || timeString === 'undefined') {
            timeString = '12:00';
        }
        
        // If timeString contains a full timestamp (YYYY-MM-DD HH:MM:SS), extract just the time
        if (timeString.includes(' ')) {
            const parts = timeString.split(' ');
            if (parts.length === 2) {
                timeString = parts[1].substring(0, 5); // Get HH:MM
            }
        }
        
        // If timeString has seconds, remove them
        if (timeString.length > 5) {
            timeString = timeString.substring(0, 5); // Get HH:MM
        }
        
        // Create a date object from the date and time
        const dateTimeStr = `${dateString}T${timeString}:00.000Z`;
        const date = new Date(dateTimeStr);
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            console.log(`   ⚠️ Invalid date: ${dateString} ${timeString}`);
            return null;
        }
        
        // Convert to Israel timezone
        const israelTime = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Jerusalem"}));
        
        // Return just the date part in YYYY-MM-DD format
        return israelTime.toISOString().split('T')[0];
    } catch (error) {
        console.log(`   ⚠️ Error converting date: ${error.message}`);
        return null;
    }
}

// Helper function to get Israel date from created_at timestamp
function getIsraelDateFromTimestamp(timestamp) {
    try {
        if (!timestamp) return null;
        
        const date = new Date(timestamp);
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            return null;
        }
        
        const israelTime = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Jerusalem"}));
        return israelTime.toISOString().split('T')[0];
    } catch (error) {
        return null;
    }
}

async function fixHistoricalStats() {
    console.log('🔧 Starting timezone fix for historical stats...\n');
    
    try {
        // Step 1: Get all calls
        console.log('📊 Fetching all calls from database...');
        const { data: allCalls, error: fetchError } = await supabase
            .from('calls')
            .select('*')
            .order('created_at', { ascending: true });
        
        if (fetchError) {
            console.error('❌ Error fetching calls:', fetchError);
            return;
        }
        
        console.log(`✅ Found ${allCalls.length} calls to process\n`);
        
        if (allCalls.length === 0) {
            console.log('ℹ️ No calls found in database. Nothing to fix.');
            return;
        }
        
        // Step 2: Analyze and fix each call
        let fixedCount = 0;
        let unchangedCount = 0;
        let errorCount = 0;
        
        console.log('🔄 Processing calls...\n');
        
        for (let i = 0; i < allCalls.length; i++) {
            const call = allCalls[i];
            const progress = `[${i + 1}/${allCalls.length}]`;
            
            try {
                let newCallDate;
                let needsUpdate = false;
                
                // Determine the correct call_date in Israel timezone
                if (call.call_date && call.start_time) {
                    // Use existing call_date and start_time, but verify it's in Israel timezone
                    newCallDate = toIsraelDate(call.call_date, call.start_time);
                    
                    if (!newCallDate) {
                        // If conversion failed, try using just the call_date
                        newCallDate = toIsraelDate(call.call_date);
                    }
                    
                    // Check if it's different from current value
                    if (newCallDate && newCallDate !== call.call_date) {
                        needsUpdate = true;
                        console.log(`${progress} 📝 Call ID ${call.id}:`);
                        console.log(`   Old date: ${call.call_date}`);
                        console.log(`   New date: ${newCallDate} (Israel timezone)`);
                    }
                } else if (call.call_date) {
                    // Have call_date but no start_time
                    newCallDate = toIsraelDate(call.call_date);
                    
                    if (newCallDate && newCallDate !== call.call_date) {
                        needsUpdate = true;
                        console.log(`${progress} 📝 Call ID ${call.id} (no time):`);
                        console.log(`   Old date: ${call.call_date}`);
                        console.log(`   New date: ${newCallDate} (Israel timezone)`);
                    }
                } else if (call.created_at) {
                    // Fallback: use created_at timestamp converted to Israel timezone
                    newCallDate = getIsraelDateFromTimestamp(call.created_at);
                    
                    if (newCallDate && newCallDate !== call.call_date) {
                        needsUpdate = true;
                        console.log(`${progress} 📝 Call ID ${call.id} (using created_at):`);
                        console.log(`   Old date: ${call.call_date || 'null'}`);
                        console.log(`   New date: ${newCallDate} (from timestamp)`);
                        console.log(`   Created at: ${call.created_at}`);
                    }
                }
                
                // Update if needed
                if (needsUpdate && newCallDate) {
                    const { error: updateError } = await supabase
                        .from('calls')
                        .update({ call_date: newCallDate })
                        .eq('id', call.id);
                    
                    if (updateError) {
                        console.error(`   ❌ Error updating: ${updateError.message}`);
                        errorCount++;
                    } else {
                        console.log(`   ✅ Updated successfully`);
                        fixedCount++;
                    }
                } else {
                    unchangedCount++;
                }
                
            } catch (error) {
                console.error(`${progress} ❌ Error processing call ID ${call.id}:`, error.message);
                console.error(`   Call data:`, JSON.stringify({
                    id: call.id,
                    call_date: call.call_date,
                    start_time: call.start_time,
                    created_at: call.created_at
                }, null, 2));
                errorCount++;
            }
        }
        
        // Step 3: Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 MIGRATION SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total calls processed: ${allCalls.length}`);
        console.log(`✅ Fixed: ${fixedCount}`);
        console.log(`➖ Unchanged: ${unchangedCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log('='.repeat(60));
        
        // Step 4: Verify stats after migration
        console.log('\n🔍 Verifying stats after migration...\n');
        
        const now = new Date();
        const israelTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Jerusalem"}));
        const today = israelTime.toISOString().split('T')[0];
        
        // Get today's calls
        const { data: todayCalls } = await supabase
            .from('calls')
            .select('id')
            .eq('call_date', today);
        
        // Get this week's calls (Sunday to Saturday)
        const weekStart = new Date(israelTime);
        const dayOfWeek = weekStart.getDay();
        weekStart.setDate(weekStart.getDate() - dayOfWeek);
        const weekStartStr = weekStart.toISOString().split('T')[0];
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const weekEndStr = weekEnd.toISOString().split('T')[0];
        
        const { data: weekCalls } = await supabase
            .from('calls')
            .select('id')
            .gte('call_date', weekStartStr)
            .lt('call_date', weekEndStr);
        
        // Get this month's calls
        const monthStart = new Date(israelTime.getFullYear(), israelTime.getMonth(), 1);
        const monthStartStr = monthStart.toISOString().split('T')[0];
        
        const monthEnd = new Date(israelTime.getFullYear(), israelTime.getMonth() + 1, 1);
        const monthEndStr = monthEnd.toISOString().split('T')[0];
        
        const { data: monthCalls } = await supabase
            .from('calls')
            .select('id')
            .gte('call_date', monthStartStr)
            .lt('call_date', monthEndStr);
        
        console.log('Current Stats (Israel Timezone):');
        console.log(`📅 Today (${today}): ${todayCalls?.length || 0} calls`);
        console.log(`📅 This Week (${weekStartStr} to ${weekEndStr}): ${weekCalls?.length || 0} calls`);
        console.log(`📅 This Month (${monthStartStr} to ${monthEndStr}): ${monthCalls?.length || 0} calls`);
        
        console.log('\n✅ Migration completed successfully!\n');
        
    } catch (error) {
        console.error('\n❌ Fatal error during migration:', error);
        process.exit(1);
    }
}

// Run the migration
console.log('🚀 Starting Historical Stats Timezone Migration');
console.log('📍 Timezone: Asia/Jerusalem (Israel)');
console.log('📅 Week: Sunday to Saturday\n');

fixHistoricalStats()
    .then(() => {
        console.log('🎉 All done!');
        process.exit(0);
    })
    .catch(error => {
        console.error('💥 Migration failed:', error);
        process.exit(1);
    });
