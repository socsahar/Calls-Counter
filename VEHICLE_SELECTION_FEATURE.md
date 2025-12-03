# Vehicle Selection Feature

## Overview
This feature allows users to select which vehicle they're tracking calls for. Once a vehicle is selected, all calls, statistics, and history will be filtered to show only data related to that vehicle.

## Key Features

### 1. **Unique Vehicle Assignment**
- No vehicle can be assigned to multiple users simultaneously
- When a user selects a vehicle, it becomes exclusively theirs until they release it
- Other users will see that the vehicle is "in use" and cannot select it

### 2. **User-Specific Data Filtering**
- **Main Dashboard**: Shows only calls for the selected vehicle
- **Statistics**: Weekly/monthly stats filtered by selected vehicle
- **History View**: Historical data filtered by selected vehicle
- **Search**: All searches respect the vehicle filter

### 3. **Smart Vehicle Selection**
- If no vehicle is selected, the system suggests the user's MDA code as a default
- Users can change their vehicle selection at any time
- Users can release their vehicle to make it available for others

## Database Structure

### Tables

#### `vehicles`
Master table of all available vehicles:
```sql
- id: UUID (primary key)
- vehicle_number: TEXT (unique)
- vehicle_type: vehicle_type_enum (motorcycle/picanto/ambulance/personal_standby)
- description: TEXT
- is_active: BOOLEAN
```

#### `user_vehicle_settings`
Tracks which user has which vehicle:
```sql
- id: UUID (primary key)
- user_id: UUID (foreign key to users, unique)
- vehicle_id: UUID (foreign key to vehicles)
- vehicle_number: TEXT (unique - enforces one vehicle per user)
- vehicle_type: TEXT
- is_default: BOOLEAN
```

### Functions

#### `set_user_vehicle(p_user_id, p_vehicle_number, p_vehicle_type)`
- Sets a vehicle for a user
- Checks if vehicle is already in use by another user
- Returns success/error with appropriate message

#### `get_user_vehicle(p_user_id)`
- Retrieves the current vehicle for a user
- Returns vehicle_number, vehicle_type, and vehicle_id

#### `get_available_vehicles()`
- Returns list of all vehicles
- Shows which vehicles are in use and by whom

#### `release_user_vehicle(p_user_id)`
- Releases a user's current vehicle
- Makes it available for other users

## API Endpoints

### GET `/api/vehicle/current`
Get the current user's selected vehicle.

**Response:**
```json
{
  "success": true,
  "data": {
    "vehicle_number": "5248",
    "vehicle_type": "motorcycle",
    "vehicle_id": "uuid...",
    "is_suggestion": false
  }
}
```

### POST `/api/vehicle/current`
Set the current user's vehicle.

**Request:**
```json
{
  "vehicle_number": "5248",
  "vehicle_type": "motorcycle"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "הרכב נבחר בהצלחה",
  "data": {
    "vehicle_number": "5248",
    "vehicle_type": "motorcycle"
  }
}
```

**Response (Vehicle In Use):**
```json
{
  "success": false,
  "message": "רכב זה כבר בשימוש על ידי משתמש אחר",
  "error_code": "VEHICLE_IN_USE"
}
```

### GET `/api/vehicles/available`
Get list of all available vehicles and their status.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "vehicle_number": "5248",
      "vehicle_type": "motorcycle",
      "description": "אופנוע מדא",
      "is_active": true,
      "in_use": true,
      "used_by_username": "sahar"
    },
    {
      "vehicle_number": "6123",
      "vehicle_type": "picanto",
      "description": "פיקנטו",
      "is_active": true,
      "in_use": false,
      "used_by_username": null
    }
  ]
}
```

### DELETE `/api/vehicle/current`
Release the current user's vehicle.

**Response:**
```json
{
  "success": true,
  "message": "הרכב שוחרר בהצלחה"
}
```

## Frontend Implementation

### Vehicle Selection UI
The main interface includes:
1. **Current Vehicle Badge**: Shows the selected vehicle prominently
2. **Change Vehicle Button**: Opens a modal to select a different vehicle
3. **Available Vehicles List**: Shows all vehicles with their current status
4. **Release Vehicle Option**: Allows users to release their current vehicle

### Filtering Behavior
Once a vehicle is selected:
- All API calls automatically filter by `vehicle_number`
- Statistics are calculated only for that vehicle's calls
- History view shows only that vehicle's historical data
- Search results are limited to that vehicle

### User Experience
1. **First Time**: User sees their MDA code as suggested vehicle
2. **Selection**: User can choose from available vehicles
3. **Confirmation**: System confirms vehicle selection
4. **Filtering**: All data immediately filters to selected vehicle
5. **Change**: User can change vehicle anytime (if not in use)
6. **Release**: User can release vehicle to make it available for others

## Migration Instructions

1. **Backup Database**: Always backup before running migrations!

2. **Run Migration**:
   ```sql
   -- Run the migration file
   \i migrations/add_vehicle_selection.sql
   ```

3. **Verify**: 
   - Check that `vehicles` table exists
   - Check that `user_vehicle_settings` table was recreated
   - Verify functions are created

4. **Test**:
   - Try selecting a vehicle
   - Verify uniqueness (try selecting same vehicle with different user)
   - Check that data filters correctly

## Admin Features

Admins can:
- View all vehicles and their assignments
- See which user has which vehicle
- Release vehicles from users (if needed)
- Add new vehicles to the system
- Deactivate vehicles

## Security & Data Isolation

### Key Security Features:
1. **User Authentication**: All endpoints require authentication
2. **User Data Isolation**: Users can only see their own calls
3. **Vehicle Uniqueness**: Database constraint ensures no duplicate assignments
4. **RLS Policies**: Row-level security enforces data access rules

### Data Filtering:
- `user_id` filter: Ensures users only see their own data
- `vehicle_number` filter: Further filters by selected vehicle
- Combined filters: Both applied for maximum isolation

## Troubleshooting

### Vehicle Already In Use
**Error**: "רכב זה כבר בשימוש על ידי משתמש אחר"
**Solution**: 
- Wait for other user to release the vehicle
- Choose a different vehicle
- Contact admin to release the vehicle if needed

### No Data Showing
**Issue**: User selected vehicle but sees no calls
**Possible Causes**:
1. No calls recorded for that vehicle yet
2. User viewing wrong date range
3. Database filter not applied correctly

**Solution**:
- Check if calls exist for that vehicle in database
- Verify date filters
- Check browser console for errors

### Vehicle Selection Not Persisting
**Issue**: Vehicle selection resets on page reload
**Solution**:
- Check that `set_user_vehicle` endpoint is being called
- Verify database connection
- Check browser console for API errors

## Future Enhancements

Potential future improvements:
1. **Vehicle History**: Track which users used which vehicles when
2. **Vehicle Availability Calendar**: Show when vehicles are available
3. **Automatic Release**: Release vehicles after inactivity period
4. **Vehicle Reservations**: Allow users to reserve vehicles in advance
5. **Vehicle Groups**: Group similar vehicles for easier management
6. **Shift Management**: Integrate with user shift schedules

## Support

For issues or questions:
1. Check browser console for errors
2. Check server logs for API errors
3. Verify database functions are working
4. Review this documentation

## Version History

### v1.0.0 - Initial Release
- Basic vehicle selection
- Unique vehicle assignment
- Data filtering by vehicle
- Available vehicles list
- Admin vehicle management
