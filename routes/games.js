const express = require('express');
const router = express.Router();

// Utility: draw a random card 1..13 (A=1, 2..10, J=11, Q=12, K=13)
function drawCard() {
  return Math.floor(Math.random() * 13) + 1;
}

function cardLabel(value) {
  if (value === 1) return 'A';
  if (value === 11) return 'J';
  if (value === 12) return 'Q';
  if (value === 13) return 'K';
  return String(value);
}

// NEW: GET /api/games - list lobby games
router.get('/', (req, res) => {
  return res.json({
    success: true,
    games: [
      { id: 900001, name: '7 Up & Down', image: '/vite.svg' },
      { id: 900002, name: 'Roulette', image: '/vite.svg' },
      { id: 900003, name: 'Teen Patti', image: 'https://cdn.dreamcasino.live/rg_teen_patti.webp' },
      { id: 900004, name: 'Dragon Tiger', image: 'https://cdn.dreamcasino.live/rg_dragon_tiger.webp' },
    ],
  });
});

// POST /api/games/7updown/play
// Body: { selection: 'up'|'down'|'seven', amount: number }
// Response: round result with payout
router.post('/7updown/play', (req, res) => {
  try {
    const { selection, amount } = req.body || {};

    const validSelections = ['up', 'down', 'seven'];
    if (!validSelections.includes(selection)) {
      return res.status(400).json({ success: false, message: 'Invalid selection. Use one of: up, down, seven' });
    }

    const betAmount = Number(amount);
    if (!Number.isFinite(betAmount) || betAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const value = drawCard();
    const resultCategory = value < 7 ? 'down' : value === 7 ? 'seven' : 'up';
    const payoutMultiplier = resultCategory === 'seven' ? 11 : 1; // typical Lucky 7 payouts

    const win = selection === resultCategory;
    const winAmount = win ? betAmount * payoutMultiplier : 0;

    const result = {
      success: true,
      game: '7updown',
      selection,
      amount: betAmount,
      card: {
        value,
        label: cardLabel(value),
      },
      category: resultCategory,
      outcome: win ? 'win' : 'lose',
      payoutMultiplier,
      winAmount,
      timestamp: new Date().toISOString(),
    };

    return res.json(result);
  } catch (err) {
    console.error('7updown/play error', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// --- Roulette helpers ---
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
function rouletteColor(n){
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

// POST /api/games/roulette/spin
// Body: { bets: [{ type: 'straight', number: 0..36, amount: number }] }
router.post('/roulette/spin', (req, res) => {
  try {
    const { bets = [] } = req.body || {};
    if (!Array.isArray(bets)) {
      return res.status(400).json({ success: false, message: 'bets must be an array' });
    }

    // Validate bets (support straight numbers only for MVP)
    const sanitized = [];
    for (const b of bets) {
      const amount = Number(b?.amount);
      const number = Number(b?.number);
      const type = b?.type || 'straight';
      if (type !== 'straight') continue;
      if (!Number.isFinite(amount) || amount <= 0) continue;
      if (!Number.isInteger(number) || number < 0 || number > 36) continue;
      sanitized.push({ type: 'straight', number, amount });
    }

    const totalBet = sanitized.reduce((s,b) => s + b.amount, 0);
    if (totalBet <= 0) {
      return res.status(400).json({ success: false, message: 'No valid bets placed' });
    }

    const resultNumber = Math.floor(Math.random() * 37); // 0..36
    const color = rouletteColor(resultNumber);

    const outcomes = sanitized.map(b => {
      const win = b.number === resultNumber;
      const payout = win ? b.amount * 35 : 0; // 35:1 for straight
      return { ...b, win, payout };
    });

    const winAmount = outcomes.reduce((s,o) => s + o.payout, 0);

    return res.json({
      success: true,
      game: 'roulette',
      number: resultNumber,
      color,
      outcomes,
      totalBet,
      winAmount,
      balanceChange: winAmount - totalBet,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('roulette/spin error', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// --- Teen Patti helpers and endpoint ---
const SUITS = ['♠','♥','♦','♣'];
const RANKS = [2,3,4,5,6,7,8,9,10,11,12,13,14]; // 11=J,12=Q,13=K,14=A

function buildDeck(){
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r, suit: s });
  return deck;
}
function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function rankLabel(r){
  if (r === 14) return 'A';
  if (r === 13) return 'K';
  if (r === 12) return 'Q';
  if (r === 11) return 'J';
  return String(r);
}
function isSequence(ranks){
  const sorted = [...ranks].sort((a,b)=>a-b);
  // Handle A-2-3 as lowest straight
  if (sorted[0] === 2 && sorted[1] === 3 && sorted[2] === 14) return {yes:true, top:3};
  return {yes: sorted[0]+1===sorted[1] && sorted[1]+1===sorted[2], top: sorted[2]};
}
function evaluateTeenPatti(hand){
  const ranks = hand.map(c=>c.rank);
  const suits = hand.map(c=>c.suit);
  ranks.sort((a,b)=>a-b);
  const sameSuit = suits.every(s=>s===suits[0]);
  const isTrail = ranks[0]===ranks[1] && ranks[1]===ranks[2];
  const seq = isSequence(ranks);
  const isFlush = sameSuit;
  const isPair = ranks[0]===ranks[1] || ranks[1]===ranks[2];

  // Rank order (high to low): Trail(6), PureSeq(5), Seq(4), Flush(3), Pair(2), High(1)
  if (isTrail) return { rank: 6, key: [ranks[2]] };
  if (seq.yes && isFlush) return { rank: 5, key: [seq.top] };
  if (seq.yes) return { rank: 4, key: [seq.top] };
  if (isFlush) return { rank: 3, key: [...ranks].reverse() };
  if (isPair) {
    const pairRank = ranks[0]===ranks[1] ? ranks[0] : ranks[1];
    const kicker = ranks[0]===ranks[1] ? ranks[2] : ranks[0];
    return { rank: 2, key: [pairRank, kicker] };
  }
  return { rank: 1, key: [...ranks].reverse() };
}
function compareHands(a,b){
  if (a.rank !== b.rank) return a.rank > b.rank ? 1 : -1;
  const len = Math.max(a.key.length, b.key.length);
  for (let i=0;i<len;i++){
    const av = a.key[i]||0, bv=b.key[i]||0;
    if (av!==bv) return av>bv?1:-1;
  }
  return 0;
}
function handRankLabel(info){
  switch(info.rank){
    case 6: return 'Trail';
    case 5: return 'Pure Sequence';
    case 4: return 'Sequence';
    case 3: return 'Color';
    case 2: return 'Pair';
    default: return 'High Card';
  }
}

// POST /api/games/teenpatti/deal
// Body: { selection: 'playerA'|'playerB'|'tie', amount: number }
router.post('/teenpatti/deal', (req, res) => {
  try {
    const { selection, amount } = req.body || {};
    const validSel = ['playerA','playerB','tie'];
    if (!validSel.includes(selection)) return res.status(400).json({ success:false, message:'Invalid selection' });
    const betAmount = Number(amount);
    if (!Number.isFinite(betAmount) || betAmount <= 0) return res.status(400).json({ success:false, message:'Invalid amount' });

    const deck = shuffle(buildDeck());
    const playerA = [deck.pop(), deck.pop(), deck.pop()];
    const playerB = [deck.pop(), deck.pop(), deck.pop()];

    const evalA = evaluateTeenPatti(playerA);
    const evalB = evaluateTeenPatti(playerB);
    const cmp = compareHands(evalA, evalB);

    let winner = 'tie';
    if (cmp>0) winner='playerA'; else if (cmp<0) winner='playerB';

    const multipliers = { playerA: 1, playerB: 1, tie: 8 };
    const win = selection===winner;
    const winAmount = win ? betAmount * multipliers[winner] : 0;

    const toView = (hand)=> hand.map(c=>({ rank: c.rank, label: rankLabel(c.rank), suit: c.suit }));

    return res.json({
      success: true,
      game: 'teenpatti',
      selection,
      amount: betAmount,
      playerA: { hand: toView(playerA), info: { rank: evalA.rank, label: handRankLabel(evalA) } },
      playerB: { hand: toView(playerB), info: { rank: evalB.rank, label: handRankLabel(evalB) } },
      winner,
      payoutMultiplier: multipliers[winner],
      winAmount,
      timestamp: new Date().toISOString(),
    });
  } catch(err){
    console.error('teenpatti/deal error', err);
    return res.status(500).json({ success:false, message:'Internal server error' });
  }
});

// --- Dragon Tiger ---
function drawDTCard(){
  // A is lowest (1), then 2..10, J=11, Q=12, K=13
  const value = Math.floor(Math.random()*13)+1;
  const label = value===1?'A':value===11?'J':value===12?'Q':value===13?'K':String(value);
  return { value, label };
}

// POST /api/games/dragon-tiger/deal
// Body: { selection: 'dragon'|'tiger'|'tie', amount: number }
router.post('/dragon-tiger/deal', (req, res) => {
  try {
    const { selection, amount } = req.body || {};
    const validSel = ['dragon','tiger','tie'];
    if (!validSel.includes(selection)) return res.status(400).json({ success:false, message:'Invalid selection' });
    const betAmount = Number(amount);
    if (!Number.isFinite(betAmount) || betAmount <= 0) return res.status(400).json({ success:false, message:'Invalid amount' });

    const dragon = drawDTCard();
    const tiger = drawDTCard();

    let winner = 'tie';
    if (dragon.value > tiger.value) winner = 'dragon';
    else if (tiger.value > dragon.value) winner = 'tiger';

    const multipliers = { dragon: 1, tiger: 1, tie: 8 };
    const win = selection === winner;
    const winAmount = win ? betAmount * multipliers[winner] : 0;

    return res.json({
      success: true,
      game: 'dragon-tiger',
      selection,
      amount: betAmount,
      dragon,
      tiger,
      winner,
      payoutMultiplier: multipliers[winner],
      winAmount,
      outcome: win ? 'win' : 'lose',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('dragon-tiger/deal error', err);
    return res.status(500).json({ success:false, message:'Internal server error' });
  }
});

module.exports = router;