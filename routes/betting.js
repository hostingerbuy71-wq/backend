const express = require('express');
const router = express.Router();
const { 
  placeBet, 
  getUserBets, 
  getMatchBets, 
  cancelBet, 
  getBettingSummary 
} = require('../controllers/bettingController');
const auth = require('../middleware/auth');

// All betting routes require authentication
router.use(auth);

// Place a new bet
router.post('/place', placeBet);
router.post('/place-bet', placeBet);

// Get user's bets
router.get('/my-bets', getUserBets);

// Get betting summary for user
router.get('/summary', getBettingSummary);

// Get bets for a specific match
router.get('/match/:matchId', getMatchBets);

// Cancel a bet
router.put('/cancel/:betId', cancelBet);

module.exports = router;