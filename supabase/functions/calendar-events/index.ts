import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CryptoEvent {
  title: string;
  description: string;
  date: string;
  category: 'listing' | 'upgrade' | 'fork' | 'airdrop' | 'partnership' | 'conference' | 'other';
  impact: 'high' | 'medium' | 'low';
  source: string;
  coins: string[];
}

// Fetch events from Binance announcements API
async function fetchBinanceEvents(symbols: string[]): Promise<CryptoEvent[]> {
  try {
    const response = await fetch('https://www.binance.com/bapi/composite/v1/public/cms/article/list/query?type=1&pageSize=20&pageNo=1');
    const data = await response.json();
    
    const events: CryptoEvent[] = [];
    
    if (data?.data?.catalogs?.[0]?.articles) {
      for (const article of data.data.catalogs[0].articles) {
        const title = article.title || '';
        const titleUpper = title.toUpperCase();
        
        // Filter for relevant symbols
        const relevantCoins = symbols.filter(symbol => titleUpper.includes(symbol));
        if (relevantCoins.length === 0) continue;
        
        // Categorize based on keywords
        let category: CryptoEvent['category'] = 'other';
        let impact: CryptoEvent['impact'] = 'medium';
        
        if (titleUpper.includes('LISTING') || titleUpper.includes('LISTS')) {
          category = 'listing';
          impact = 'high';
        } else if (titleUpper.includes('UPGRADE') || titleUpper.includes('MAINNET')) {
          category = 'upgrade';
          impact = 'high';
        } else if (titleUpper.includes('PARTNERSHIP') || titleUpper.includes('PARTNERS')) {
          category = 'partnership';
          impact = 'medium';
        } else if (titleUpper.includes('AIRDROP')) {
          category = 'airdrop';
          impact = 'medium';
        } else if (titleUpper.includes('FORK')) {
          category = 'fork';
          impact = 'high';
        }
        
        events.push({
          title: title,
          description: article.summary || '',
          date: new Date(article.releaseDate || Date.now()).toISOString(),
          category,
          impact,
          source: 'Binance',
          coins: relevantCoins
        });
      }
    }
    
    return events;
  } catch (error) {
    console.error('Error fetching Binance events:', error);
    return [];
  }
}

// Fetch events from CoinGecko (free, no API key required)
async function fetchCoinGeckoEvents(symbols: string[]): Promise<CryptoEvent[]> {
  try {
    const events: CryptoEvent[] = [];
    
    // Convert symbols to CoinGecko IDs (simple mapping)
    const symbolToId: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'BNB': 'binancecoin',
      'SOL': 'solana',
      'ADA': 'cardano',
      'XRP': 'ripple',
      'DOT': 'polkadot',
      'DOGE': 'dogecoin',
      'AVAX': 'avalanche-2',
      'MATIC': 'matic-network',
      'LINK': 'chainlink',
      'UNI': 'uniswap',
      'ATOM': 'cosmos',
      'LTC': 'litecoin',
      'XLM': 'stellar'
    };
    
    for (const symbol of symbols) {
      const coinId = symbolToId[symbol];
      if (!coinId) continue;
      
      try {
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`);
        const data = await response.json();
        
        // Check for upcoming events in description
        if (data?.description?.en) {
          const description = data.description.en;
          
          // Detect upgrades mentions
          if (description.includes('upgrade') || description.includes('hard fork')) {
            events.push({
              title: `${symbol} Network Upgrade`,
              description: 'Potential network upgrade detected',
              date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              category: 'upgrade',
              impact: 'medium',
              source: 'CoinGecko',
              coins: [symbol]
            });
          }
        }
        
        // Add delay to respect rate limits (free tier)
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (error) {
        console.error(`Error fetching ${symbol} from CoinGecko:`, error);
      }
    }
    
    return events;
  } catch (error) {
    console.error('Error fetching CoinGecko events:', error);
    return [];
  }
}

// Fetch and combine events from multiple sources
async function fetchEventsFromAPI(symbols: string[]): Promise<CryptoEvent[]> {
  console.log('Fetching events from multiple sources for:', symbols);
  
  // Fetch from both sources in parallel
  const [binanceEvents, geckoEvents] = await Promise.all([
    fetchBinanceEvents(symbols),
    fetchCoinGeckoEvents(symbols)
  ]);
  
  // Combine and deduplicate events
  const allEvents = [...binanceEvents, ...geckoEvents];
  
  // Remove duplicates based on title and date
  const uniqueEvents = allEvents.filter((event, index, self) =>
    index === self.findIndex((e) => 
      e.title === event.title && 
      new Date(e.date).toDateString() === new Date(event.date).toDateString()
    )
  );
  
  console.log(`Found ${uniqueEvents.length} unique events from ${allEvents.length} total`);
  
  return uniqueEvents;
}

// Calculate event impact score
function calculateEventImpact(event: CryptoEvent): number {
  const impactScores = { high: 3, medium: 2, low: 1 };
  const categoryBonus = {
    listing: 2,
    upgrade: 2,
    partnership: 1.5,
    fork: 1,
    airdrop: 0.5,
    conference: 0.2,
    other: 0
  };

  const baseScore = impactScores[event.impact];
  const bonus = categoryBonus[event.category];
  
  // Events in the next 7 days get additional weight
  const daysUntil = (new Date(event.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  const timeMultiplier = daysUntil <= 7 ? 1.5 : daysUntil <= 30 ? 1.2 : 1.0;
  
  return (baseScore + bonus) * timeMultiplier;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbols } = await req.json();
    console.log('Fetching events for:', symbols);

    if (!symbols || !Array.isArray(symbols)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid symbols parameter',
        events: []
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch events
    const events = await fetchEventsFromAPI(symbols);

    // Calculate impact scores
    const eventsWithScores = events.map(event => ({
      ...event,
      impactScore: calculateEventImpact(event),
      daysUntil: Math.ceil((new Date(event.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    }));

    // Sort by impact score and date
    eventsWithScores.sort((a, b) => {
      if (a.impactScore !== b.impactScore) {
        return b.impactScore - a.impactScore;
      }
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    // Calculate overall event sentiment
    const avgImpact = eventsWithScores.length > 0
      ? eventsWithScores.reduce((sum, e) => sum + e.impactScore, 0) / eventsWithScores.length
      : 0;

    const highImpactEvents = eventsWithScores.filter(e => e.impact === 'high');

    return new Response(JSON.stringify({ 
      events: eventsWithScores,
      summary: {
        totalEvents: eventsWithScores.length,
        highImpactEvents: highImpactEvents.length,
        averageImpact: avgImpact,
        nextMajorEvent: highImpactEvents[0] || null
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in calendar-events:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      events: [],
      summary: {
        totalEvents: 0,
        highImpactEvents: 0,
        averageImpact: 0,
        nextMajorEvent: null
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
