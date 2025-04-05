function analyzeTelemetry(telemetry, playerName) {
    const headshotKills = [];
    const suspiciousIndicators = [];

    for (const event of telemetry) {
        if (event._T === 'LogPlayerKill' && event.killer.name === playerName) {
            const isHeadshot = event.isHeadshot;
            const distance = event.distance;

            if (isHeadshot && distance > 50) {
                headshotKills.push({ distance });
            }
        }
    }

    if (headshotKills.length > 5) {
        suspiciousIndicators.push(`⚠️ ${headshotKills.length} headshots over 50m`);
    }

    const isSuspicious = suspiciousIndicators.length > 0;

    return { isSuspicious, suspiciousIndicators };
}
module.exports = { analyzeTelemetry };
