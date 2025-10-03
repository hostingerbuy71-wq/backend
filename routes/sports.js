const axios = require('axios');
const express = require('express');
const router = express.Router();
const zlib = require("zlib");
const xml2js = require("xml2js");
const { parseStringPromise } = xml2js; 
// Helper: safe fetch with timeout
async function safeFetch(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// Helper: Goalserve API request using request library
function goalserveRequest(url) {
  return new Promise((resolve, reject) => {
    const request = require('request');
    const options = {
      method: 'GET',
      url: url,
      timeout: 10000,
     
    };
    
    request(options, function (error, response, body) {
      if (error) {
        reject(new Error(error));
      } else if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
      } else {
        resolve({ body, response });
      }
    });
  });
}

// Normalize to a common shape for the frontend
function normalize(matches) {
  return matches.map((m, i) => ({
    id: m.id || `m_${i}`,
    display: m.display || `${m.team1 || m.teams?.[0] || 'Team 1'} vs ${m.team2 || m.teams?.[1] || 'Team 2'}`,
    status: m.status || 'Live',
    tournament: m.tournament || 'Match'
  }));
}

// Demo datasets used as last resort
const demo = {
  cricket: [
    { id: 'demo_c_1', display: '🔴 DEMO: India vs Australia', status: 'Live', tournament: 'Border-Gavaskar Trophy' },
    { id: 'demo_c_2', display: '🔴 DEMO: England vs Pakistan', status: 'Upcoming', tournament: 'Test Series' },
    { id: 'demo_c_3', display: '🔴 DEMO: Mumbai Indians vs CSK', status: 'Live', tournament: 'IPL' }
  ],
  tennis: [
    { id: 'demo_t_1', display: '🔴 DEMO: Novak Djokovic vs Rafael Nadal', status: 'Live', tournament: 'ATP Masters 1000' },
    { id: 'demo_t_2', display: '🔴 DEMO: Iga Swiatek vs Aryna Sabalenka', status: 'Upcoming', tournament: 'WTA Finals' },
    { id: 'demo_t_3', display: '🔴 DEMO: Carlos Alcaraz vs Daniil Medvedev', status: 'Live', tournament: 'Wimbledon' }
  ],
  soccer: [
    { 
      id: 'demo_s_1', 
      name: 'Manchester United vs Liverpool',
      display: '🔴 DEMO: Manchester United vs Liverpool', 
      status: 'Live', 
      tournament: 'Premier League',
      info: { league: 'Premier League', period: '2nd Half' },
      team_info: { 
        home: { name: 'Manchester United' }, 
        away: { name: 'Liverpool' } 
      }
    },
    { 
      id: 'demo_s_2', 
      name: 'Barcelona vs Real Madrid',
      display: '🔴 DEMO: Barcelona vs Real Madrid', 
      status: 'Upcoming', 
      tournament: 'La Liga',
      info: { league: 'La Liga', status: 'Upcoming' },
      team_info: { 
        home: { name: 'Barcelona' }, 
        away: { name: 'Real Madrid' } 
      }
    },
    { 
      id: 'demo_s_3', 
      name: 'Bayern Munich vs Dortmund',
      display: '🔴 DEMO: Bayern Munich vs Dortmund', 
      status: 'Live', 
      tournament: 'Bundesliga',
      info: { league: 'Bundesliga', period: '1st Half' },
      team_info: { 
        home: { name: 'Bayern Munich' }, 
        away: { name: 'Dortmund' } 
      }
    }
  ]
};

// GET /api/sports/cricket
router.get('/cricket', async (req, res) => {
  const results = { source: null, fallbackUsed: false, data: [] };

  try {
    // Prefer CricAPI if available
    if (process.env.CRICAPI_KEY) {
      const r = await safeFetch(`https://api.cricapi.com/v1/currentMatches?apikey=${process.env.CRICAPI_KEY}&offset=0`);
      if (r.ok) {
        const json = await r.json();
        if (Array.isArray(json.data) && json.data.length) {
          results.source = 'cricapi';
          results.data = json.data.slice(0, 12).map((m, i) => ({
            id: m.id || `cric_${i}`,
            display: `${m.teams?.[0] || 'Team 1'} vs ${m.teams?.[1] || 'Team 2'}`,
            status: m.status || m.matchType || 'Live',
            tournament: m.series || m.venue || 'Cricket Match'
          }));
          return res.json({ success: true, ...results });
        }
      }
    }

    // Fallback to RapidAPI host if configured
    if (process.env.RAPIDAPI_KEY && process.env.CRICKET_RAPIDAPI_HOST) {
      const r = await safeFetch(`https://${process.env.CRICKET_RAPIDAPI_HOST}/matches`, {
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': process.env.CRICKET_RAPIDAPI_HOST
        }
      });
      if (r.ok) {
        const json = await r.json();
        const arr = json.matches || json.data || (Array.isArray(json) ? json : []);
        if (Array.isArray(arr) && arr.length) {
          results.source = 'rapidapi-cricket';
          results.data = arr.slice(0, 12).map((m, i) => ({
            id: m.id || `rapid_${i}`,
            display: `${m.team1?.name || m.teams?.[0] || 'Team 1'} vs ${m.team2?.name || m.teams?.[1] || 'Team 2'}`,
            status: m.status || 'Live',
            tournament: m.tournament?.name || m.series || 'Cricket Match'
          }));
          return res.json({ success: true, ...results });
        }
      }
    }

    // If everything fails, serve demo
    results.fallbackUsed = true;
    results.source = 'demo';
    results.data = demo.cricket;
    return res.json({ success: true, ...results });
  } catch (e) {
    return res.status(200).json({ success: true, source: 'demo', fallbackUsed: true, data: demo.cricket });
  }
});

// GET /api/sports/tennis
router.get('/tennis', async (req, res) => {
  const results = { source: null, fallbackUsed: false, data: [] };
  try {
    // RapidAPI Tennis Live Data
    if (process.env.RAPIDAPI_KEY) {
      const r = await safeFetch('https://tennisapi-tennis-live-data-v1.p.rapidapi.com/matches/live', {
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'tennisapi-tennis-live-data-v1.p.rapidapi.com'
        }
      });
      if (r.ok) {
        const json = await r.json();
        if (Array.isArray(json.results) && json.results.length) {
          results.source = 'rapidapi-tennis';
          results.data = json.results.slice(0, 12).map((m, i) => ({
            id: m.id || `tennis_${i}`,
            display: `${m.homeCompetitor?.name || m.player1 || 'Player 1'} vs ${m.awayCompetitor?.name || m.player2 || 'Player 2'}`,
            status: m.status || m.matchStatus || 'Live',
            tournament: m.tournament?.name || m.event || 'Tennis Tournament'
          }));
          return res.json({ success: true, ...results });
        }
      }
    }

    // Sportradar if key available
    if (process.env.SPORTRADAR_TENNIS_KEY) {
      const r = await safeFetch(`https://api.sportradar.com/tennis/trial/v3/en/schedules/live/summaries.json?api_key=${process.env.SPORTRADAR_TENNIS_KEY}`);
      if (r.ok) {
        const json = await r.json();
        if (Array.isArray(json.summaries) && json.summaries.length) {
          results.source = 'sportradar';
          results.data = json.summaries.slice(0, 12).map((m, i) => ({
            id: m.sport_event?.id || `tennis_alt_${i}`,
            display: `${m.sport_event?.competitors?.[0]?.name || 'Player 1'} vs ${m.sport_event?.competitors?.[1]?.name || 'Player 2'}`,
            status: m.sport_event_status?.status || 'Live',
            tournament: m.sport_event?.tournament?.name || 'Tennis Tournament'
          }));
          return res.json({ success: true, ...results });
        }
      }
    }

    results.fallbackUsed = true;
    results.source = 'demo';
    results.data = demo.tennis;
    return res.json({ success: true, ...results });
  } catch (e) {
    return res.status(200).json({ success: true, source: 'demo', fallbackUsed: true, data: demo.tennis });
  }
});

// GET /api/sports/soccer
// router.get('/soccer', async (req, res) => {
//   const results = { source: null, fallbackUsed: false, data: [] };
//   try {
//     // Try Goalserve Soccer API first
//     try {
//       console.log('🏈 Attempting Goalserve Soccer API...');
//       const goalserveResult = await goalserveRequest('http://inplay.goalserve.com/inplay-soccer.gz');
      
//       if (goalserveResult && goalserveResult.body) {
//         console.log('🏈 Goalserve Soccer API Response received',goalserveResult);
        
//         // Parse the response (assuming it's JSON or XML)
//         let soccerData;
//         try {
//           // Try parsing as JSON first
//           soccerData = JSON.parse(goalserveResult.body);
//         } catch (jsonError) {
//           // If JSON parsing fails, it might be XML or compressed data
//           console.log('🏈 Response is not JSON, might be XML or compressed data');
//           soccerData = goalserveResult.body;
//         }
        
//         console.log('🏈 Goalserve Soccer Data:', JSON.stringify(soccerData, null, 2));
        
//         // Extract matches from the data structure
//         let matches = [];
//         if (typeof soccerData === 'object' && soccerData !== null) {
//           // Handle different possible data structures
//           matches = soccerData.matches || soccerData.games || soccerData.fixtures || [];
//           if (!Array.isArray(matches) && soccerData.data) {
//             matches = soccerData.data.matches || soccerData.data.games || [];
//           }
//         }
        
//         if (Array.isArray(matches) && matches.length > 0) {
//           results.source = 'goalserve-soccer';
//           results.data = matches.slice(0, 12).map((m, i) => ({
//             id: m.id || m.match_id || `goalserve_soccer_${i}`,
//             display: `${m.home_team || m.localteam || m.team1 || 'Team 1'} vs ${m.away_team || m.visitorteam || m.team2 || 'Team 2'}`,
//             status: m.status || m.match_status || 'Live',
//             tournament: m.league || m.competition || m.tournament || 'Soccer League',
//             score: m.score || `${m.home_score || 0} - ${m.away_score || 0}`,
//             time: m.time || m.minute || m.elapsed || '0\''
//           }));
          
//           console.log(`🏈 Successfully loaded ${results.data.length} soccer matches from Goalserve`);
//           return res.json({ success: true, ...results });
//         } else {
//           console.log('🏈 No matches found in Goalserve response, trying other APIs...');
//         }
//       }
//     } catch (goalserveError) {
//       console.error('🏈 Goalserve Soccer API Error:', goalserveError.message);
//     }

//     // Football-data.org
//     if (process.env.FOOTBALL_DATA_API_KEY) {
//       const r = await safeFetch('https://api.football-data.org/v4/matches?status=LIVE', {
//         headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY }
//       });
//       if (r.ok) {
//         const json = await r.json();
//         if (Array.isArray(json.matches) && json.matches.length) {
//           results.source = 'football-data';
//           results.data = json.matches.slice(0, 12).map((m, i) => ({
//             id: m.id || `football_${i}`,
//             display: `${m.homeTeam?.name || 'Team 1'} vs ${m.awayTeam?.name || 'Team 2'}`,
//             status: m.status || (m.score?.winner ? 'Finished' : 'Live'),
//             tournament: m.competition?.name || 'Football League'
//           }));
//           return res.json({ success: true, ...results });
//         }
//       }
//     }

//     // API-Football via RapidAPI
//     if (process.env.RAPIDAPI_KEY) {
//       const r = await safeFetch('https://api-football-v1.p.rapidapi.com/v3/fixtures?live=all', {
//         headers: {
//           'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
//           'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
//         }
//       });
//       if (r.ok) {
//         const json = await r.json();
//         if (Array.isArray(json.response) && json.response.length) {
//           results.source = 'api-football';
//           results.data = json.response.slice(0, 12).map((m, i) => ({
//             id: m.fixture?.id || `apisports_${i}`,
//             display: `${m.teams?.home?.name || 'Team 1'} vs ${m.teams?.away?.name || 'Team 2'}`,
//             status: m.fixture?.status?.long || 'Live',
//             tournament: m.league?.name || 'Football League'
//           }));
//           return res.json({ success: true, ...results });
//         }
//       }
//     }

//     results.fallbackUsed = true;
//     results.source = 'demo';
//     results.data = demo.soccer;
//     return res.json({ success: true, ...results });
//   } catch (e) {
//     return res.status(200).json({ success: true, source: 'demo', fallbackUsed: true, data: demo.soccer });
//   }
// });
// router.get("/soccer", async (req, res) => {
//   const results = { source: null, fallbackUsed: false, data: [] };
  
//   try {
//     console.log('⚽ Attempting to fetch soccer data from Goalserve API...');
    
//     const response = await axios.get(
//       "http://inplay.goalserve.com/inplay-soccer.gz",
//       { 
//         responseType: "arraybuffer",
//         timeout: 10000 // 10 second timeout
//       }
//     );

//     let data;
//     try {
//       // decompress gzip
//       const decompressed = zlib.gunzipSync(response.data);
//       data = decompressed.toString("utf-8");
//     } catch {
//       // not gzip
//       data = response.data.toString("utf-8");
//     }

//     let parsedData;
//     // agar JSON hai
//     if (data.trim().startsWith("{")) {
//       parsedData = JSON.parse(data);
//     } 
//     // agar XML hai
//     else {
//       parsedData = await parseStringPromise(data);
//     }

//     // Check if we have valid soccer data
//     if (parsedData && (parsedData.events || parsedData.matches)) {
//       console.log('⚽ Successfully fetched live soccer data from Goalserve');
//       results.source = 'goalserve';
//       return res.json({ success: true, ...parsedData });
//     } else {
//       throw new Error('No valid soccer data found in API response');
//     }
    
//   } catch (error) {
//     console.error("❌ Error fetching Goalserve soccer data:", error.message);
    
//     // Return demo data as fallback
//     console.log('⚽ Falling back to demo soccer data');
//     results.fallbackUsed = true;
//     results.source = 'demo';
//     results.data = demo.soccer;
    
//     // Create events structure similar to live API
//     const eventsData = {};
//     demo.soccer.forEach((match, index) => {
//       eventsData[`demo_${index + 1}`] = match;
//     });
    
//     return res.json({ 
//       success: true, 
//       source: 'demo',
//       fallbackUsed: true,
//       events: eventsData,
//       data: demo.soccer
//     });
//   }
// });


router.get("/soccer", async (req, res) => {
  try {
    const response = await axios.get(
      "http://inplay.goalserve.com/inplay-soccer.gz",
      {
        responseType: "arraybuffer",
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept-Encoding": "gzip, deflate"
        }
      }
    );

    // Decompress if gzipped
    let rawData;
    try {
      rawData = zlib.gunzipSync(response.data).toString("utf-8");
    } catch {
      rawData = response.data.toString("utf-8");
    }

    // Parse into JSON
    let parsedData;
    if (rawData.trim().startsWith("{")) {
      parsedData = JSON.parse(rawData);
    } else if (rawData.trim().startsWith("<")) {
      parsedData = await parseStringPromise(rawData, { explicitArray: false });
    } else {
      return res.json({ success: false, message: "Unknown data format", raw: rawData });
    }

    // ✅ Return only clean JSON
    return res.json({
      success: true,
      data: parsedData
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Error fetching data",
      error: err.message
    });
  }
});


module.exports = router;