function analyzeTelemetry(telemetry, playerName) {
    const normalizedName = playerName.toLowerCase();

    let totalShots = 0;
    let totalHits = 0;
    let totalKills = 0;
    let headshotKills = 0;
    let longRangeHeadshots = 0;

    const reasons = [];

    for (const event of telemetry) {
        // 🔫 Weapon fired
        if (event._T === 'LogWeaponFire' && event.character?.name?.toLowerCase() === normalizedName) {
            totalShots++;
        }

        // 🎯 Player attack (hit registered)
        if (event._T === 'LogPlayerAttack' && event.attacker?.name?.toLowerCase() === normalizedName && event.victim) {
            totalHits++;
        }

        // ☠️ Kill + headshot tracking
        if (event._T === 'LogPlayerKill' && event.killer?.name?.toLowerCase() === normalizedName) {
            totalKills++;
            const isHeadshot = event.isHeadshot;
            const distance = event.distance;

            if (isHeadshot) {
                headshotKills++;
                if (distance > 50) {
                    longRangeHeadshots++;
                }
            }
        }
    }

    // 📊 Derived metrics
    const accuracy = totalShots > 0 ? (totalHits / totalShots) * 100 : 0;
    const kdRatio = totalKills; // one-match logic
    const suspicious = reasons.length > 0;

    // 🚨 Suspicion triggers
    if (longRangeHeadshots > 5) {
        reasons.push(`🎯 ${longRangeHeadshots} headshots over 50m`);
    }

    if (totalKills >= 2 && totalKills === headshotKills) {
        reasons.push(`💀 All ${totalKills} kills were headshots`);
    }

    if (accuracy > 85) {
        reasons.push(`📈 Accuracy too high: ${accuracy.toFixed(1)}%`);
    }

    if (kdRatio >= 6) {
        reasons.push(`⚠️ KD too high: ${kdRatio.toFixed(2)}`);
    }

    if (totalKills > 10) {
        reasons.push(`🔫 High kill count: ${totalKills}`);
    }

    //  Fallback if no data but match shows action
    const noCombatData = totalShots === 0 && totalHits === 0 && totalKills === 0;

    return {
        suspicious: reasons.length > 0,
        reasons: noCombatData ? ['⚠️ No telemetry recorded for this player'] : reasons,
        totalShots,
        totalHits,
        accuracy,
        kdRatio,
        headshotsOver50m: longRangeHeadshots,
        headshotKills,
        totalKills
    };
}

module.exports = { analyzeTelemetry };
