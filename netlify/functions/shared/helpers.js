// Helper function to convert English call types to Hebrew
function normalizeCallType(callType) {
    const callTypeMap = {
        'urgent': 'דחוף',
        'atan': 'אט"ן', 
        'aran': 'ארן',
        'natbag': 'נתבג',
        'דחוף': 'דחוף',
        'אט"ן': 'אט"ן',
        'אט״ן': 'אט"ן',
        'ארן': 'ארן',
        'נתבג': 'נתבג'
    };
    return callTypeMap[callType] || callType;
}

// Vehicle type detection
function detectVehicleType(mdaCode) {
    if (!mdaCode) return 'ambulance';
    
    const codeStr = mdaCode.toString().trim();
    const len = codeStr.length;
    const firstDigit = codeStr.charAt(0);
    
    if (len === 5 && (firstDigit === '1' || firstDigit === '2')) {
        return 'personal_standby';
    }
    
    if (len === 4) {
        if (firstDigit === '5') return 'motorcycle';
        if (firstDigit === '6') return 'picanto';
        if (['1', '2', '3', '4', '7', '8', '9'].includes(firstDigit)) return 'ambulance';
    }
    
    if ((len === 2 || len === 3) && ['1', '2', '3', '4', '7', '8', '9'].includes(firstDigit)) {
        return 'ambulance';
    }
    
    return 'ambulance';
}

module.exports = { normalizeCallType, detectVehicleType };
