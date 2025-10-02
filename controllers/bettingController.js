const Bet = require('../models/Bet');
const User = require('../models/User');

// Place a new bet
const placeBet = async (req, res) => {
  try {
    const { matchId, runner, betType, odds, stake, matchDetails } = req.body;
    const userId = req.user.id;

    // Validation
    if (!matchId || !runner || !betType || !odds || !stake) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (stake < 1) {
      return res.status(400).json({
        success: false,
        message: 'Minimum stake is 1'
      });
    }

    if (stake > 250000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum stake is 250,000'
      });
    }

    // Get user to check balance
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate required amount
    let requiredAmount = stake;
    if (betType === 'lay') {
      requiredAmount = stake * (odds - 1); // Liability for lay bets
    }

    // Check if user has sufficient balance (assuming user has a balance field)
    // Note: You may need to add balance field to User model
    if (user.balance && user.balance < requiredAmount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    // Create new bet
    const newBet = new Bet({
      userId,
      matchId,
      runner,
      betType,
      odds: parseFloat(odds),
      stake: parseFloat(stake),
      matchDetails
    });

    await newBet.save();

    // Update user balance (if balance field exists)
    if (user.balance !== undefined) {
      user.balance -= requiredAmount;
      await user.save();
    }

    res.status(201).json({
      success: true,
      message: 'Bet placed successfully',
      bet: newBet
    });

  } catch (error) {
    console.error('Error placing bet:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while placing bet'
    });
  }
};

// Get user's bets
const getUserBets = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, matchId } = req.query;

    let query = { userId };
    
    if (status) {
      query.status = status;
    }
    
    if (matchId) {
      query.matchId = matchId;
    }

    const bets = await Bet.find(query)
      .sort({ placedAt: -1 })
      .limit(50);

    res.json({
      success: true,
      bets
    });

  } catch (error) {
    console.error('Error fetching user bets:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching bets'
    });
  }
};

// Get match bets (for admin or public view)
const getMatchBets = async (req, res) => {
  try {
    const { matchId } = req.params;

    const bets = await Bet.getMatchBets(matchId);

    // Group bets by runner and type for market display
    const marketData = {};
    
    bets.forEach(bet => {
      if (!marketData[bet.runner]) {
        marketData[bet.runner] = {
          back: [],
          lay: []
        };
      }
      
      marketData[bet.runner][bet.betType].push({
        odds: bet.odds,
        amount: bet.unmatchedAmount,
        userId: bet.userId._id,
        username: bet.userId.username
      });
    });

    res.json({
      success: true,
      marketData,
      totalBets: bets.length
    });

  } catch (error) {
    console.error('Error fetching match bets:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching match bets'
    });
  }
};

// Cancel a bet
const cancelBet = async (req, res) => {
  try {
    const { betId } = req.params;
    const userId = req.user.id;

    const bet = await Bet.findOne({
      _id: betId,
      userId: userId,
      status: 'pending'
    });

    if (!bet) {
      return res.status(404).json({
        success: false,
        message: 'Bet not found or cannot be cancelled'
      });
    }

    bet.status = 'cancelled';
    await bet.save();

    // Refund user balance
    const user = await User.findById(userId);
    if (user && user.balance !== undefined) {
      const refundAmount = bet.betType === 'lay' ? bet.liability : bet.stake;
      user.balance += refundAmount;
      await user.save();
    }

    res.json({
      success: true,
      message: 'Bet cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling bet:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling bet'
    });
  }
};

// Get betting summary for a user
const getBettingSummary = async (req, res) => {
  try {
    const userId = req.user.id;

    const summary = await Bet.aggregate([
      { $match: { userId: mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalStake: { $sum: '$stake' },
          totalPayout: { $sum: '$payout' }
        }
      }
    ]);

    const user = await User.findById(userId).select('balance');

    res.json({
      success: true,
      summary,
      balance: user?.balance || 0
    });

  } catch (error) {
    console.error('Error fetching betting summary:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching summary'
    });
  }
};

module.exports = {
  placeBet,
  getUserBets,
  getMatchBets,
  cancelBet,
  getBettingSummary
};