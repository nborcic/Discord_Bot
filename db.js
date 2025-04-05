const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  matchId: String,
  playerName: String,
  createdAt: Date,
  telemetry: Object,
  suspicious: Boolean,
  indicators: [String]
});

const Match = mongoose.model('Match', matchSchema);

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('🧬 MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB error:', error);
  }
};

module.exports = { connectDB, Match };
