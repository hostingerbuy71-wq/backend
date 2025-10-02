const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  matchId: {
    type: String,
    required: true
  },
  runner: {
    type: String,
    required: true, // Arsenal, Olympiakos, Draw etc.
  },
  betType: {
    type: String,
    enum: ['back', 'lay'],
    required: true
  },
  odds: {
    type: Number,
    required: true
  },
  stake: {
    type: Number,
    required: true,
    min: 1
  },
  potentialWin: {
    type: Number,
    required: true
  },
  liability: {
    type: Number,
    default: 0 // For lay bets
  },
  status: {
    type: String,
    enum: ['pending', 'matched', 'cancelled', 'settled', 'void'],
    default: 'pending'
  },
  matchedAmount: {
    type: Number,
    default: 0
  },
  unmatchedAmount: {
    type: Number,
    default: function() {
      return this.stake;
    }
  },
  placedAt: {
    type: Date,
    default: Date.now
  },
  settledAt: {
    type: Date
  },
  result: {
    type: String,
    enum: ['won', 'lost', 'void'],
    default: null
  },
  payout: {
    type: Number,
    default: 0
  },
  // Match details for reference
  matchDetails: {
    homeTeam: String,
    awayTeam: String,
    tournament: String,
    matchDate: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
betSchema.index({ userId: 1, status: 1 });
betSchema.index({ matchId: 1, status: 1 });
betSchema.index({ placedAt: -1 });

// Calculate potential win before saving
betSchema.pre('save', function(next) {
  if (this.betType === 'back') {
    this.potentialWin = (this.stake * this.odds) - this.stake;
    this.liability = 0;
  } else if (this.betType === 'lay') {
    this.potentialWin = this.stake;
    this.liability = this.stake * (this.odds - 1);
  }
  next();
});

// Static method to get user's active bets
betSchema.statics.getUserActiveBets = function(userId) {
  return this.find({
    userId: userId,
    status: { $in: ['pending', 'matched'] }
  }).sort({ placedAt: -1 });
};

// Static method to get match bets
betSchema.statics.getMatchBets = function(matchId) {
  return this.find({
    matchId: matchId,
    status: { $in: ['pending', 'matched'] }
  }).populate('userId', 'username fullName');
};

module.exports = mongoose.model('Bet', betSchema);