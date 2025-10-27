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

// Simulate event data - in production, this would fetch from CoinMarketCal API or similar
async function fetchEventsFromAPI(symbols: string[]): Promise<CryptoEvent[]> {
  // Mock data for demonstration
  const mockEvents: CryptoEvent[] = [
    {
      title: "Major Exchange Listing",
      description: "Listing on a top-tier exchange",
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      category: 'listing',
      impact: 'high',
      source: 'Exchange Announcement',
      coins: ['BTC', 'ETH']
    },
    {
      title: "Network Upgrade",
      description: "Major protocol improvement",
      date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      category: 'upgrade',
      impact: 'high',
      source: 'Official Roadmap',
      coins: ['ETH']
    },
    {
      title: "Community AMA",
      description: "Ask Me Anything with development team",
      date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      category: 'conference',
      impact: 'low',
      source: 'Social Media',
      coins: ['BTC']
    }
  ];

  // Filter events for requested symbols
  return mockEvents.filter(event => 
    symbols.some(symbol => event.coins.includes(symbol))
  );
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
