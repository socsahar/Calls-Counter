// PDF Export Helper with Hebrew Support using HTML2Canvas
async function exportCallsToPDF(calls, year, month, currentVehicle) {
    if (!window.html2canvas || !window.jspdf) {
        throw new Error('PDF libraries not loaded');
    }

    const { jsPDF } = window.jspdf;

    // Month names in Hebrew
    const monthNames = {
        1: 'ינואר', 2: 'פברואר', 3: 'מרץ', 4: 'אפריל',
        5: 'מאי', 6: 'יוני', 7: 'יולי', 8: 'אוגוסט',
        9: 'ספטמבר', 10: 'אוקטובר', 11: 'נובמבר', 12: 'דצמבר'
    };

    const periodText = month ? `${monthNames[parseInt(month)]} ${year}` : `שנת ${year}`;
    const vehicleText = `רכב ${currentVehicle.number}`;
    
    // Calculate statistics
    const stats = calculateStatsForPDF(calls);

    // Create temporary container
    const container = document.createElement('div');
    container.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: 210mm;
        background: white;
        padding: 20mm;
        font-family: 'Rubik', Arial, sans-serif;
        direction: rtl;
        color: #000;
        box-sizing: border-box;
    `;

    // Build HTML content with proper Hebrew
    const callsRows = calls.map((call, index) => {
        const callDate = new Date(call.call_date || call.created_at);
        const formattedDate = callDate.toLocaleDateString('he-IL', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        });
        
        const startTime = call.start_time ? call.start_time.substring(0, 5) : '-';
        const endTime = call.end_time ? call.end_time.substring(0, 5) : '-';
        const duration = call.duration_minutes ? `${call.duration_minutes} דק'` : '-';
        
        const location = [call.city, call.street, call.location].filter(Boolean).join(', ') || '-';
        const alertCode = call.alert_code || '-';
        const medicalCode = call.medical_code || '-';

        return `
            <tr style="${index % 2 === 0 ? 'background: #f9fafb;' : ''}">
                <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600;">${index + 1}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${call.call_type || '-'}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${formattedDate}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${startTime}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${endTime}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${duration}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${location}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${alertCode}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${medicalCode}</td>
            </tr>
        `;
    }).join('');

    const formatHours = (hours) => {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h} שעות ${m} דקות`;
    };

    container.innerHTML = `
        <div style="text-align: center; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
            <div style="font-size: 40px; margin-bottom: 10px;">🏍️</div>
            <h1 style="margin: 0 0 10px 0; font-size: 28px; font-weight: 700;">דוח קריאות - מד״א</h1>
            <h2 style="margin: 0; font-size: 20px; font-weight: 500;">${periodText}</h2>
            <h3 style="margin: 8px 0 0 0; font-size: 16px; font-weight: 400;">${vehicleText}</h3>
        </div>

        <div style="margin-bottom: 25px;">
            <h2 style="color: #dc2626; border-bottom: 3px solid #dc2626; padding-bottom: 8px; margin-bottom: 15px; font-size: 20px;">סיכום סטטיסטי</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 14px;">
                <tr style="background: #f3f4f6;">
                    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: 600;">סה״כ קריאות:</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center; font-weight: 700;">${stats.totalCalls}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: 600;">קריאות דחופות:</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">${stats.urgentCalls}</td>
                </tr>
                <tr style="background: #f3f4f6;">
                    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: 600;">קריאות אט״ן:</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">${stats.atanCalls}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: 600;">קריאות ארן:</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">${stats.aranCalls}</td>
                </tr>
                <tr style="background: #f3f4f6;">
                    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: 600;">קריאות נתב״ג:</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">${stats.netbagCalls}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: 600;">סה״כ שעות:</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">${formatHours(stats.totalHours)}</td>
                </tr>
            </table>
        </div>

        <div style="margin-bottom: 15px;">
            <h2 style="color: #dc2626; border-bottom: 3px solid #dc2626; padding-bottom: 8px; margin-bottom: 15px; font-size: 20px;">פירוט קריאות</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                <thead>
                    <tr style="background: #dc2626; color: white;">
                        <th style="padding: 8px; border: 1px solid #991b1b; font-weight: 700;">#</th>
                        <th style="padding: 8px; border: 1px solid #991b1b; font-weight: 700;">סוג</th>
                        <th style="padding: 8px; border: 1px solid #991b1b; font-weight: 700;">תאריך</th>
                        <th style="padding: 8px; border: 1px solid #991b1b; font-weight: 700;">התחלה</th>
                        <th style="padding: 8px; border: 1px solid #991b1b; font-weight: 700;">סיום</th>
                        <th style="padding: 8px; border: 1px solid #991b1b; font-weight: 700;">משך</th>
                        <th style="padding: 8px; border: 