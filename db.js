// db.js
const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    matchId: String,
    playerName: String,
    createdAt: Date,
    mapName: String,
    gameMode: String,
    winPlace: Number,
    timeSurvived: Number,
    kills: Number,
    assists: Number,
    damageDealt: Number,
    headshotKills: Number,
    longestKill: Number,
    DBNOs: Number,
    teamKills: Number,
    revives: Number,
    rideDistance: Number,
    walkDistance: Number,
    boosts: Number,
    heals: Number,
    weaponsAcquired: Number,
    telemetry: Object,
    analysis: {
        suspicious: Boolean,
        reasons: [String],
        headshotsOver50m: Number,
        totalShots: Number,
        totalHits: Number,
        accuracy: Number,
        kdRatio: Number,
        longestKill: Number
    }
});


const Match = mongoose.model('Match', matchSchema);

const flaggedSchema = new mongoose.Schema({
    playerName: { type: String, unique: true },
    flaggedAt: { type: Date, default: Date.now },
    suspiciousMatches: Number,
    matchesAnalyzed: Number,
    avgKD: Number,
    avgAccuracy: Number,
    avgHeadshotsOver50m: Number
});

const FlaggedPlayer = mongoose.model('FlaggedPlayer', flaggedSchema);


const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ MongoDB connected');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
    }
};

module.exports = { connectDB, Match, FlaggedPlayer };