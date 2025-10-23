import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting market analysis...');

    // Fetch top cryptocurrencies by market cap
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    const tickers = await response.json();

    // Filter for USDT pairs and sort by volume
    const usdtPairs = tickers.filter((t: any) => 
      t.symbol.endsWith('USDT') && 
      !t.symbol.includes('DOWN') && 
      !t.symbol.includes('UP') &&
      !t.symbol.includes('BULL') &&
      !t.symbol.includes('BEAR')
    ).sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));

    const opportunities = [];

    // Analyze top 50 by volume
    for (const ticker of usdtPairs.slice(0, 50)) {
      try {
        // Get klines data for analysis
        const klinesRes = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${ticker.symbol}&interval=1d&limit=100`
        );
        const klines = await klinesRes.json();

        if (!Array.isArray(klines) || klines.length < 50) continue;

        const closes = klines.map((k: any) => parseFloat(k[4]));
        const highs = klines.map((k: any) => parseFloat(k[2]));
        const lows = klines.map((k: any) => parseFloat(k[3]));
        const volumes = klines.map((k: any) => parseFloat(k[5]));

        const currentPrice = parseFloat(ticker.lastPrice);
        const priceChange24h = parseFloat(ticker.priceChangePercent);

        // Calculate ATH and drawdown
        const ath = Math.max(...highs);
        const drawdownFromATH = ((currentPrice - ath) / ath) * 100;

        // Calculate RSI
        const rsi = calculateRSI(closes, 14);

        // Calculate momentum (20 vs 50 day MA)
        const ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const ma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
        const momentum = ((ma20 - ma50) / ma50) * 100;

        // Calculate volume trend
        const avgVolume20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const currentVolume = parseFloat(ticker.volume);
        const volumeIncrease = ((currentVolume - avgVolume20) / avgVolume20) * 100;

        // Scoring system for opportunities
        let score = 50; // Base score

        // Drawdown scoring (more drawdown = more potential)
        if (drawdownFromATH < -70) score += 30;
        else if (drawdownFromATH < -50) score += 20;
        else if (drawdownFromATH < -30) score += 10;

        // RSI scoring (oversold is good)
        if (rsi < 30) score += 20;
        else if (rsi < 40) score += 10;
        else if (rsi > 70) score -= 10;

        // Momentum scoring
        if (momentum > 5) score += 15;
        else if (momentum > 2) score += 10;
        else if (momentum < -5) score -= 10;

        // Volume scoring
        if (volumeIncrease > 50) score += 15;
        else if (volumeIncrease > 20) score += 10;

        // Price action scoring
        if (priceChange24h > 10) score += 10;
        else if (priceChange24h > 5) score += 5;
        else if (priceChange24h < -10) score += 5; // Dip opportunity

        // Only include high-scoring opportunities
        if (score >= 70) {
          const baseName = ticker.symbol.replace('USDT', '');
          
          opportunities.push({
            symbol: ticker.symbol,
            name: baseName,
            score: Math.min(100, score) / 10,
            price: currentPrice,
            change24h: priceChange24h,
            drawdownFromATH: drawdownFromATH,
            rsi: rsi,
            momentum: momentum,
            volumeIncrease: volumeIncrease,
            strategy: determineStrategy(drawdownFromATH, rsi, momentum),
            thesis: generateThesis(baseName, drawdownFromATH, rsi, momentum, volumeIncrease, priceChange24h)
          });
        }
      } catch (error) {
        console.error(`Error analyzing ${ticker.symbol}:`, error);
        continue;
      }
    }

    // Sort by score
    opportunities.sort((a, b) => b.score - a.score);

    console.log(`Found ${opportunities.length} opportunities`);

    return new Response(
      JSON.stringify({ opportunities: opportunities.slice(0, 20) }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Market analysis error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function calculateRSI(prices: number[], period = 14): number {
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function determineStrategy(drawdown: number, rsi: number, momentum: number): string {
  if (drawdown < -50 && rsi < 40) {
    return "DCA (Accumulation long terme)";
  } else if (momentum > 5 && rsi < 70) {
    return "Swing Trading (Momentum positif)";
  } else if (drawdown < -30 && momentum > 0) {
    return "Swing + DCA (Reprise progressive)";
  } else {
    return "Swing Trading";
  }
}

function generateThesis(
  name: string,
  drawdown: number,
  rsi: number,
  momentum: number,
  volumeIncrease: number,
  priceChange24h: number
): string {
  let thesis = `${name} présente actuellement `;
  
  if (drawdown < -50) {
    thesis += `un drawdown significatif de ${drawdown.toFixed(1)}% depuis l'ATH, suggérant une sous-valorisation potentielle. `;
  } else if (drawdown < -30) {
    thesis += `une correction de ${drawdown.toFixed(1)}% depuis l'ATH. `;
  }

  if (rsi < 30) {
    thesis += `Le RSI en zone de survente (${rsi.toFixed(1)}) indique une opportunité d'achat technique. `;
  } else if (rsi < 40) {
    thesis += `Le RSI à ${rsi.toFixed(1)} suggère un asset proche de la survente. `;
  }

  if (momentum > 5) {
    thesis += `Le momentum fortement positif (+${momentum.toFixed(1)}%) confirme une reprise haussière. `;
  } else if (momentum > 0) {
    thesis += `Le momentum positif (+${momentum.toFixed(1)}%) indique un retournement en cours. `;
  }

  if (volumeIncrease > 50) {
    thesis += `Les volumes explosent (+${volumeIncrease.toFixed(0)}%), signe d'un regain d'intérêt institutionnel. `;
  } else if (volumeIncrease > 20) {
    thesis += `Les volumes augmentent (+${volumeIncrease.toFixed(0)}%). `;
  }

  if (priceChange24h > 10) {
    thesis += `Le mouvement de +${priceChange24h.toFixed(1)}% sur 24h confirme la dynamique haussière.`;
  } else if (priceChange24h < -10) {
    thesis += `La baisse de ${priceChange24h.toFixed(1)}% sur 24h représente une opportunité d'entrée à prix réduit.`;
  }

  return thesis;
}