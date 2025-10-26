import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Opportunity {
  symbol: string;
  name: string;
  score: number;
  price: number;
  change24h: number;
  drawdownFromATH: number;
  rsi: number;
  momentum: number;
  volumeIncrease: number;
  marketCapScore: number;
  fundamentalScore: number;
  sentimentScore: number;
  strategy: string;
  thesis: string;
  catalysts: string[];
  timeframe: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 50, threshold = 65 } = await req.json().catch(() => ({}));
    console.log(`Starting market analysis with limit=${limit}, threshold=${threshold}`);

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

    const opportunities: Opportunity[] = [];

    // Analyze top pairs based on limit
    for (const ticker of usdtPairs.slice(0, limit)) {
      try {
        // Get klines data for analysis
        const klinesRes = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${ticker.symbol}&interval=1d&limit=100`
        );
        const klines = await klinesRes.json();

        if (!Array.isArray(klines) || klines.length < 50) continue;

        const closes = klines.map((k: any) => parseFloat(k[4]));
        const highs = klines.map((k: any) => parseFloat(k[2]));
        const volumes = klines.map((k: any) => parseFloat(k[5]));

        const currentPrice = parseFloat(ticker.lastPrice);
        const priceChange24h = parseFloat(ticker.priceChangePercent);
        const quoteVolume = parseFloat(ticker.quoteVolume);

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

        // TECHNICAL SCORING (40 points max)
        let technicalScore = 0;
        
        // Drawdown scoring (15 points)
        if (drawdownFromATH < -70) technicalScore += 15;
        else if (drawdownFromATH < -50) technicalScore += 12;
        else if (drawdownFromATH < -30) technicalScore += 8;
        else if (drawdownFromATH > -10) technicalScore -= 5;

        // RSI scoring (10 points)
        if (rsi < 25) technicalScore += 10;
        else if (rsi < 35) technicalScore += 7;
        else if (rsi < 45) technicalScore += 4;
        else if (rsi > 75) technicalScore -= 5;

        // Momentum scoring (10 points)
        if (momentum > 8) technicalScore += 10;
        else if (momentum > 4) technicalScore += 7;
        else if (momentum > 1) technicalScore += 4;
        else if (momentum < -5) technicalScore -= 5;

        // Volume scoring (5 points)
        if (volumeIncrease > 80) technicalScore += 5;
        else if (volumeIncrease > 40) technicalScore += 3;
        else if (volumeIncrease > 15) technicalScore += 1;

        // FUNDAMENTAL SCORING (30 points max)
        let fundamentalScore = 0;
        
        // Market cap proxy via quote volume (15 points)
        // Higher volume = more liquidity = better fundamentals
        if (quoteVolume > 1000000000) fundamentalScore += 15; // >1B
        else if (quoteVolume > 500000000) fundamentalScore += 12; // >500M
        else if (quoteVolume > 100000000) fundamentalScore += 8; // >100M
        else if (quoteVolume > 50000000) fundamentalScore += 5; // >50M
        else fundamentalScore -= 5; // Low liquidity penalty

        // Price stability assessment (10 points)
        const priceVolatility = Math.abs(priceChange24h);
        if (priceVolatility < 3 && momentum > 0) fundamentalScore += 10; // Stable upward
        else if (priceVolatility < 5) fundamentalScore += 6;
        else if (priceVolatility > 20) fundamentalScore -= 5; // Too volatile

        // Distribution health (5 points) - using volume consistency
        const volumeStd = calculateStdDev(volumes.slice(-20));
        const volumeCV = volumeStd / avgVolume20;
        if (volumeCV < 0.5) fundamentalScore += 5; // Consistent volume
        else if (volumeCV < 1) fundamentalScore += 2;

        // SENTIMENT SCORING (30 points max)
        // Simplified sentiment based on market behavior
        let sentimentScore = 0;
        
        // Price action sentiment (15 points)
        if (priceChange24h > 15 && volumeIncrease > 50) sentimentScore += 15; // Strong bullish
        else if (priceChange24h > 8 && volumeIncrease > 25) sentimentScore += 12;
        else if (priceChange24h > 3) sentimentScore += 8;
        else if (priceChange24h < -15) sentimentScore -= 10; // Panic selling

        // Recovery pattern sentiment (15 points)
        if (drawdownFromATH < -50 && momentum > 3 && rsi < 50) {
          sentimentScore += 15; // Classic reversal setup
        } else if (drawdownFromATH < -30 && momentum > 0) {
          sentimentScore += 10;
        }

        // TOTAL SCORE (100 points max)
        const totalScore = technicalScore + fundamentalScore + sentimentScore;

        // Only include opportunities above threshold
        if (totalScore >= threshold) {
          const baseName = ticker.symbol.replace('USDT', '');
          
          // Identify catalysts
          const catalysts = identifyCatalysts(
            drawdownFromATH,
            momentum,
            volumeIncrease,
            priceChange24h,
            rsi
          );

          // Determine optimal timeframe
          const timeframe = determineTimeframe(momentum, volumeIncrease, drawdownFromATH);

          opportunities.push({
            symbol: ticker.symbol,
            name: baseName,
            score: Math.round(totalScore * 10) / 10,
            price: currentPrice,
            change24h: priceChange24h,
            drawdownFromATH,
            rsi,
            momentum,
            volumeIncrease,
            marketCapScore: Math.round(fundamentalScore * 10) / 10,
            fundamentalScore: Math.round(fundamentalScore * 10) / 10,
            sentimentScore: Math.round(sentimentScore * 10) / 10,
            strategy: determineStrategy(drawdownFromATH, rsi, momentum, timeframe),
            thesis: generateDetailedThesis(
              baseName,
              drawdownFromATH,
              rsi,
              momentum,
              volumeIncrease,
              priceChange24h,
              quoteVolume,
              catalysts,
              totalScore
            ),
            catalysts,
            timeframe
          });
        }
      } catch (error) {
        console.error(`Error analyzing ${ticker.symbol}:`, error);
        continue;
      }
    }

    // Sort by score
    opportunities.sort((a, b) => b.score - a.score);

    console.log(`Found ${opportunities.length} opportunities above threshold ${threshold}`);

    return new Response(
      JSON.stringify({ 
        opportunities,
        analyzed: Math.min(limit, usdtPairs.length),
        threshold,
        resultsCount: opportunities.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Market analysis error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      opportunities: []
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateStdDev(values: number[]): number {
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
  return Math.sqrt(avgSquareDiff);
}

function identifyCatalysts(
  drawdown: number,
  momentum: number,
  volumeIncrease: number,
  priceChange24h: number,
  rsi: number
): string[] {
  const catalysts: string[] = [];

  if (drawdown < -60) {
    catalysts.push("Drawdown extrême depuis ATH - potentiel de rebond majeur");
  }
  if (momentum > 5 && volumeIncrease > 40) {
    catalysts.push("Momentum haussier confirmé avec volumes institutionnels");
  }
  if (rsi < 30 && priceChange24h > 5) {
    catalysts.push("Sortie de survente avec momentum positif");
  }
  if (volumeIncrease > 100) {
    catalysts.push("Explosion des volumes - attention médiatique majeure");
  }
  if (priceChange24h > 20) {
    catalysts.push("Mouvement parabolique en cours");
  }
  if (drawdown < -40 && momentum > 3) {
    catalysts.push("Pattern de retournement bottom fishing");
  }

  return catalysts.length > 0 ? catalysts : ["Configuration technique standard"];
}

function determineTimeframe(momentum: number, volumeIncrease: number, drawdown: number): string {
  if (momentum > 8 && volumeIncrease > 60) {
    return "Court terme (1-7 jours)";
  } else if (momentum > 3 && volumeIncrease > 30) {
    return "Moyen terme (1-4 semaines)";
  } else if (drawdown < -50) {
    return "Long terme (1-6 mois)";
  } else {
    return "Swing trading (2-4 semaines)";
  }
}

function determineStrategy(
  drawdown: number,
  rsi: number,
  momentum: number,
  timeframe: string
): string {
  if (drawdown < -60 && rsi < 40) {
    return `DCA Agressif (${timeframe})`;
  } else if (drawdown < -40 && momentum > 0) {
    return `DCA + Swing (${timeframe})`;
  } else if (momentum > 5 && rsi < 70) {
    return `Momentum Trading (${timeframe})`;
  } else if (momentum > 3) {
    return `Swing Trading (${timeframe})`;
  } else {
    return `Accumulation Progressive (${timeframe})`;
  }
}

function generateDetailedThesis(
  name: string,
  drawdown: number,
  rsi: number,
  momentum: number,
  volumeIncrease: number,
  priceChange24h: number,
  quoteVolume: number,
  catalysts: string[],
  score: number
): string {
  let thesis = `**${name}** | Score: ${score.toFixed(1)}/100\n\n`;
  
  // Market positioning
  thesis += `📊 **POSITIONNEMENT MARCHÉ**\n`;
  if (drawdown < -60) {
    thesis += `• Drawdown critique de ${drawdown.toFixed(1)}% depuis ATH - zone de valeur historique\n`;
  } else if (drawdown < -40) {
    thesis += `• Correction significative de ${drawdown.toFixed(1)}% depuis ATH\n`;
  } else if (drawdown > -15) {
    thesis += `• Prix proche des sommets (${drawdown.toFixed(1)}% de l'ATH)\n`;
  }

  // Technical analysis
  thesis += `\n📈 **ANALYSE TECHNIQUE**\n`;
  if (rsi < 30) {
    thesis += `• RSI en survente extrême (${rsi.toFixed(1)}) - opportunité d'achat technique majeure\n`;
  } else if (rsi < 40) {
    thesis += `• RSI à ${rsi.toFixed(1)} - zone d'accumulation favorable\n`;
  } else if (rsi > 70) {
    thesis += `• RSI en surachat (${rsi.toFixed(1)}) - prudence recommandée\n`;
  } else {
    thesis += `• RSI neutre à ${rsi.toFixed(1)}\n`;
  }

  if (momentum > 8) {
    thesis += `• Momentum explosif (+${momentum.toFixed(1)}%) - tendance haussière forte établie\n`;
  } else if (momentum > 3) {
    thesis += `• Momentum positif (+${momentum.toFixed(1)}%) - reprise en cours\n`;
  } else if (momentum > 0) {
    thesis += `• Début de retournement haussier (+${momentum.toFixed(1)}%)\n`;
  } else {
    thesis += `• Momentum baissier (${momentum.toFixed(1)}%) - attendre confirmation\n`;
  }

  // Volume analysis
  thesis += `\n💰 **ANALYSE DES VOLUMES**\n`;
  thesis += `• Volume quotidien: $${(quoteVolume / 1000000).toFixed(0)}M\n`;
  if (volumeIncrease > 80) {
    thesis += `• Explosion des volumes (+${volumeIncrease.toFixed(0)}%) - attention institutionnelle majeure\n`;
  } else if (volumeIncrease > 40) {
    thesis += `• Volumes en forte hausse (+${volumeIncrease.toFixed(0)}%) - intérêt croissant\n`;
  } else if (volumeIncrease > 0) {
    thesis += `• Volumes en hausse modérée (+${volumeIncrease.toFixed(0)}%)\n`;
  } else {
    thesis += `• Volumes en baisse (${volumeIncrease.toFixed(0)}%) - surveiller la liquidité\n`;
  }

  // Price action
  if (Math.abs(priceChange24h) > 5) {
    thesis += `• Variation 24h: ${priceChange24h > 0 ? '+' : ''}${priceChange24h.toFixed(1)}%`;
    if (priceChange24h > 15) {
      thesis += ` - mouvement parabolique en cours\n`;
    } else if (priceChange24h > 8) {
      thesis += ` - dynamique haussière confirmée\n`;
    } else if (priceChange24h < -15) {
      thesis += ` - correction brutale en cours\n`;
    } else {
      thesis += `\n`;
    }
  }

  // Catalysts
  if (catalysts.length > 0) {
    thesis += `\n🎯 **CATALYSEURS IDENTIFIÉS**\n`;
    catalysts.forEach(catalyst => {
      thesis += `• ${catalyst}\n`;
    });
  }

  // Conclusion
  thesis += `\n📝 **CONCLUSION**\n`;
  if (score >= 85) {
    thesis += `Opportunité exceptionnelle avec convergence forte de tous les indicateurs. Setup haute probabilité.`;
  } else if (score >= 75) {
    thesis += `Très bonne opportunité avec indicateurs majoritairement favorables. Configuration intéressante.`;
  } else if (score >= 65) {
    thesis += `Opportunité valide avec potentiel correct. Surveiller l'évolution des indicateurs.`;
  } else {
    thesis += `Setup acceptable mais nécessite confirmation supplémentaire.`;
  }

  return thesis;
}