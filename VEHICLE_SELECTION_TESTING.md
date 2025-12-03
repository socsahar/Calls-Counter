# Vehicle Selection Feature - Testing Checklist

## 🧪 Complete Testing Checklist

Use this checklist to verify all aspects of the vehicle selection feature are working correctly.

---

## ✅ Part 1: UI/UX Testing

### Test 1.1: Vehicle Badge Visibility
- [ ] Desktop vehicle badge is visible at top of page
- [ ] Badge shows vehicle number correctly
- [ ] Badge shows vehicle type (emoji + Hebrew name)
- [ ] Badge has hover effect (slight lift and shadow)
- [ ] Change icon (⚙️) is visible on badge

### Test 1.2: Mobile Vehicle Badge
- [ ] Open app on mobile device or narrow browser window
- [ ] Mobile vehicle badge visible in header
- [ ] Badge displays vehicle number
- [ ] Badge displays vehicle type
- [ ] Change icon visible on mobile badge

### Test 1.3: Modal Opening
- [ ] Click desktop vehicle badge → modal opens
- [ ] Click mobile vehicle badge → modal opens
- [ ] Modal displays centered on screen
- [ ] Modal has semi-transparent dark overlay
- [ ] Modal has proper styling (rounded corners, shadow)

### Test 1.4: Modal Contents
- [ ] Modal title: "בחירת רכב"
- [ ] Info text visible explaining feature
- [ ] Warning text about uniqueness visible
- [ ] Vehicle number input field present
- [ ] Placeholder text: "הזן מספר רכב (לדוגמה: 5248)"
- [ ] Current vehicle display shows "טוען..." initially
- [ ] Three buttons visible: ביטול, שחרר רכב (hidden if no vehicle), בחר רכב

---

## ✅ Part 2: Functionality Testing

### Test 2.1: Vehicle Selection - Success Case
1. [ ] Click vehicle badge to open modal
2. [ ] Current vehicle loads and displays correctly
3. [ ] Enter vehicle number: `5248`
4. [ ] Click "בחר רכב" button
5. [ ] Success message appears: "הרכב נבחר בהצלחה!"
6. [ ] Badge updates with new vehicle number
7. [ ] Badge updates with correct vehicle type (🏍️ אופנוע)
8. [ ] Modal closes automatically after 1.5 seconds
9. [ ] Page data refreshes (stats and calls reload)

### Test 2.2: Vehicle Auto-Detection
Test each vehicle type pattern:

**Motorcycle (5xxx):**
- [ ] Enter `5248` → Detects as אופנוע (🏍️)
- [ ] Enter `5999` → Detects as אופנוע (🏍️)

**Picanto (6xxx):**
- [ ] Enter `6000` → Detects as פיקנטו (🚗)
- [ ] Enter `6543` → Detects as פיקנטו (🚗)

**Personal Standby (5-digit 1xxxx or 2xxxx):**
- [ ] Enter `12345` → Detects as כונן אישי (👨‍⚕️)
- [ ] Enter `23456` → Detects as כונן אישי (👨‍⚕️)

**Ambulance (other patterns):**
- [ ] Enter `1234` → Detects as אמבולנס (🚑)
- [ ] Enter `7890` → Detects as אמבולנס (🚑)

### Test 2.3: Uniqueness Constraint
1. [ ] Log in as User A
2. [ ] Select vehicle `5248`
3. [ ] Verify selection succeeds
4. [ ] Open incognito/private window
5. [ ] Log in as User B
6. [ ] Try to select vehicle `5248`
7. [ ] Error message appears: "רכב זה כבר בשימוש על ידי משתמש אחר"
8. [ ] Error message styled correctly (red border, warning icon)
9. [ ] Modal stays open
10. [ ] Try different vehicle number (e.g., `6000`)
11. [ ] Selection succeeds for different vehicle

### Test 2.4: Vehicle Release
1. [ ] Open vehicle selection modal
2. [ ] Verify "שחרר רכב" button is visible
3. [ ] Click "שחרר רכב" button
4. [ ] Confirmation dialog appears
5. [ ] Click OK in confirmation
6. [ ] Success message appears: "הרכב שוחרר בהצלחה"
7. [ ] Badge updates to fallback (MDA code)
8. [ ] "שחרר רכב" button becomes hidden in modal
9. [ ] Current vehicle display shows "לא נבחר רכב"
10. [ ] Data refreshes

### Test 2.5: Input Validation
- [ ] Try to submit empty input → Error: "נא להזין מספר רכב"
- [ ] Try whitespace only → Error: "נא להזין מספר רכב"
- [ ] Enter valid number → No error

---

## ✅ Part 3: Data Filtering Testing

### Test 3.1: Calls Filtering
1. [ ] Select vehicle `5248`
2. [ ] Add a new call
3. [ ] Verify call appears in today's calls list
4. [ ] Switch to vehicle `6000`
5. [ ] Verify previous call (from 5248) does NOT appear
6. [ ] Add another call
7. [ ] Verify only second call appears
8. [ ] Switch back to `5248`
9. [ ] Verify first call reappears

### Test 3.2: Stats Filtering
1. [ ] Note current daily stats
2. [ ] Select different vehicle
3. [ ] Verify stats update to show that vehicle's data
4. [ ] Check weekly stats update correctly
5. [ ] Check monthly stats update correctly

### Test 3.3: History Page Filtering
1. [ ] Select vehicle `5248`
2. [ ] Navigate to History page
3. [ ] Verify only calls from vehicle `5248` appear
4. [ ] Go back to main page
5. [ ] Change to vehicle `6000`
6. [ ] Go to History page again
7. [ ] Verify only calls from vehicle `6000` appear

### Test 3.4: Fallback Behavior
1. [ ] Release vehicle (or log in fresh without selecting)
2. [ ] Verify badge shows user's MDA code
3. [ ] Add a call
4. [ ] Verify call saved with user's MDA code
5. [ ] Verify stats show user's MDA code data

---

## ✅ Part 4: Modal Interaction Testing

### Test 4.1: Closing Modal
- [ ] Click X button → modal closes
- [ ] Click "ביטול" button → modal closes
- [ ] Click dark overlay → modal closes
- [ ] Press Escape key → modal closes (if implemented)
- [ ] After successful selection → modal auto-closes

### Test 4.2: Modal Persistence
- [ ] Open modal
- [ ] Click inside modal content area → modal stays open
- [ ] Click input field → modal stays open
- [ ] Type in input → modal stays open

### Test 4.3: Error Message Display
- [ ] Trigger an error (e.g., occupied vehicle)
- [ ] Verify error message displays with red styling
- [ ] Verify warning icon (⚠️) appears
- [ ] Close and reopen modal
- [ ] Verify error message cleared

### Test 4.4: Success Message Display
- [ ] Select a vehicle successfully
- [ ] Verify success message displays with green styling
- [ ] Verify checkmark icon (✓) appears
- [ ] Wait for auto-close
- [ ] Reopen modal
- [ ] Verify success message cleared

---

## ✅ Part 5: Backend API Testing

### Test 5.1: GET /api/vehicle/current
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/vehicle/current
```
Expected Response:
```json
{
  "success": true,
  "data": {
    "vehicle_number": "5248",
    "vehicle_type": "motorcycle"
  }
}
```
- [ ] Returns 200 OK with data when vehicle selected
- [ ] Returns 200 OK with fallback when no vehicle selected
- [ ] Returns 401 Unauthorized without token

### Test 5.2: POST /api/vehicle/current
```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"vehicle_number":"5248"}' \
  http://localhost:3000/api/vehicle/current
```
- [ ] Returns 200 OK when vehicle available
- [ ] Returns 409 Conflict when vehicle occupied
- [ ] Returns 400 Bad Request with missing vehicle_number
- [ ] Returns 401 Unauthorized without token

### Test 5.3: DELETE /api/vehicle/current
```bash
curl -X DELETE -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/vehicle/current
```
- [ ] Returns 200 OK when vehicle released
- [ ] Returns appropriate message
- [ ] Returns 401 Unauthorized without token

### Test 5.4: GET /api/vehicles/available
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/vehicles/available
```
- [ ] Returns list of all vehicles
- [ ] Each vehicle has `in_use` boolean flag
- [ ] Returns 401 Unauthorized without token

---

## ✅ Part 6: Database Testing

### Test 6.1: Tables Exist
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('vehicles', 'user_vehicle_settings');
```
- [ ] Both tables exist

### Test 6.2: Functions Exist
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%vehicle%';
```
- [ ] `set_user_vehicle` exists
- [ ] `get_user_vehicle` exists
- [ ] `get_available_vehicles` exists
- [ ] `release_user_vehicle` exists

### Test 6.3: Uniqueness Constraint
```sql
-- Try to insert duplicate vehicle_number
INSERT INTO user_vehicle_settings (user_id, vehicle_number, vehicle_type)
VALUES ('USER_UUID_1', '5248', 'motorcycle');

INSERT INTO user_vehicle_settings (user_id, vehicle_number, vehicle_type)
VALUES ('USER_UUID_2', '5248', 'motorcycle');
```
- [ ] Second insert fails with unique constraint violation

### Test 6.4: RLS Policies
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('vehicles', 'user_vehicle_settings');
```
- [ ] Both tables have RLS enabled (`rowsecurity = true`)

---

## ✅ Part 7: Cross-Browser Testing

### Desktop Browsers
- [ ] Chrome (latest) - Full functionality
- [ ] Firefox (latest) - Full functionality
- [ ] Edge (latest) - Full functionality
- [ ] Safari (if available) - Full functionality

### Mobile Browsers
- [ ] Chrome Mobile - Full functionality
- [ ] Safari iOS - Full functionality
- [ ] Samsung Internet - Full functionality

---

## ✅ Part 8: Performance Testing

### Test 8.1: Load Times
- [ ] Modal opens in < 300ms
- [ ] Vehicle selection completes in < 1 second
- [ ] Data refresh after selection < 2 seconds

### Test 8.2: Multiple Users
- [ ] 5 users selecting different vehicles simultaneously
- [ ] No conflicts or errors
- [ ] All selections saved correctly

### Test 8.3: Network Conditions
- [ ] Test on slow 3G connection
- [ ] Verify proper loading states
- [ ] Verify error handling for timeouts

---

## ✅ Part 9: Error Handling Testing

### Test 9.1: Server Errors
- [ ] Simulate server down → Appropriate error message
- [ ] Simulate 500 error → User-friendly message
- [ ] Simulate timeout → Retry or error message

### Test 9.2: Network Errors
- [ ] Disconnect internet → Error message appears
- [ ] Reconnect → Can retry successfully

### Test 9.3: Invalid Data
- [ ] Send invalid vehicle number format
- [ ] Send non-existent vehicle type
- [ ] Send malformed JSON

---

## ✅ Part 10: Accessibility Testing

### Test 10.1: Keyboard Navigation
- [ ] Tab through modal elements
- [ ] Enter key submits form
- [ ] Escape key closes modal
- [ ] Focus visible on all interactive elements

### Test 10.2: Screen Reader
- [ ] Modal title announced
- [ ] Input labels readable
- [ ] Error messages announced
- [ ] Success messages announced

### Test 10.3: RTL Support
- [ ] Hebrew text displays right-to-left
- [ ] Icons positioned correctly
- [ ] Form layout correct for RTL

---

## 📊 Test Results Summary

| Category | Total Tests | Passed | Failed | Notes |
|----------|------------|--------|--------|-------|
| UI/UX | 15 | | | |
| Functionality | 35 | | | |
| Data Filtering | 20 | | | |
| Modal Interaction | 15 | | | |
| Backend API | 12 | | | |
| Database | 8 | | | |
| Cross-Browser | 7 | | | |
| Performance | 7 | | | |
| Error Handling | 9 | | | |
| Accessibility | 9 | | | |
| **TOTAL** | **137** | | | |

---

## 🐛 Bug Report Template

If you find issues, document them using this template:

```
**Test Number:** [e.g., Test 2.3 - Uniqueness Constraint]
**Expected Result:** [What should happen]
**Actual Result:** [What actually happened]
**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Browser:** [Chrome 120 / Firefox 121 / etc.]
**Device:** [Desktop / Mobile]
**Screenshots:** [Attach if possible]
**Console Errors:** [Copy any errors from browser console]
**Server Logs:** [Copy relevant server logs]
```

---

## ✅ Sign-Off

Once all tests pass:

- [ ] All critical tests (Parts 1-4) passing
- [ ] All backend tests (Part 5) passing
- [ ] Database tests (Part 6) passing
- [ ] No major bugs found
- [ ] Performance acceptable
- [ ] Documentation complete

**Tested By:** ___________________  
**Date:** ___________________  
**Status:** ⬜ Approved / ⬜ Needs Work  

---

**Last Updated:** December 2024  
**Version:** 1.0  
**Total Tests:** 137
