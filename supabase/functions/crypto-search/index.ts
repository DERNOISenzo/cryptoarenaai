import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CryptoResult {
  symbol: string;
  name: string;
  baseAsset: string;
  quoteAsset: string;
  price: number;
  change24h: number;
  volume24h: number;
}

interface BinanceTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, quoteAsset = 'USDT' } = await req.json();
    console.log('Searching for:', query, 'with quote:', quoteAsset);

    // Fetch Binance exchange info
    const exchangeInfoRes = await fetch('https://api.binance.com/api/v3/exchangeInfo');
    const exchangeInfo = await exchangeInfoRes.json();
    
    // Filter trading pairs by quote asset
    const tradingPairs = exchangeInfo.symbols.filter((s: any) => 
      s.status === 'TRADING' && 
      s.quoteAsset === quoteAsset
    );

    // Fetch 24h ticker data for all symbols
    const ticker24hRes = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    const ticker24h: BinanceTicker[] = await ticker24hRes.json();
    
    // Create a map for quick lookup
    const tickerMap = new Map<string, BinanceTicker>(ticker24h.map((t) => [t.symbol, t]));

    // Search logic
    const searchTerm = query.toUpperCase().trim();
    let results: CryptoResult[] = [];

    if (searchTerm) {
      // Search by symbol or base asset
      results = tradingPairs
        .filter((pair: any) => {
          const symbolMatch = pair.symbol.includes(searchTerm);
          const baseMatch = pair.baseAsset.includes(searchTerm);
          return symbolMatch || baseMatch;
        })
        .slice(0, 50)
        .map((pair: any) => {
          const ticker = tickerMap.get(pair.symbol);
          return {
            symbol: pair.symbol,
            name: pair.baseAsset,
            baseAsset: pair.baseAsset,
            quoteAsset: pair.quoteAsset,
            price: ticker ? parseFloat(ticker.lastPrice) : 0,
            change24h: ticker ? parseFloat(ticker.priceChangePercent) : 0,
            volume24h: ticker ? parseFloat(ticker.quoteVolume) : 0,
          };
        });
    } else {
      // Return top pairs by volume
      results = tradingPairs
        .map((pair: any) => {
          const ticker = tickerMap.get(pair.symbol);
          return {
            symbol: pair.symbol,
            name: pair.baseAsset,
            baseAsset: pair.baseAsset,
            quoteAsset: pair.quoteAsset,
            price: ticker ? parseFloat(ticker.lastPrice) : 0,
            change24h: ticker ? parseFloat(ticker.priceChangePercent) : 0,
            volume24h: ticker ? parseFloat(ticker.quoteVolume) : 0,
          };
        })
        .sort((a: CryptoResult, b: CryptoResult) => b.volume24h - a.volume24h)
        .slice(0, 50);
    }

    // Try to get full names from CoinGecko for top results
    try {
      const topResults = results.slice(0, 10);
      for (const result of topResults) {
        const cgRes = await fetch(`https://api.coingecko.com/api/v3/search?query=${result.baseAsset}`);
        const cgData = await cgRes.json();
        if (cgData.coins && cgData.coins.length > 0) {
          const match = cgData.coins.find((c: any) => 
            c.symbol.toUpperCase() === result.baseAsset.toUpperCase()
          );
          if (match) {
            result.name = match.name;
          }
        }
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('CoinGecko enrichment error:', error);
      // Continue without full names
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in crypto-search:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
