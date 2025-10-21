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
    const { symbol, action } = await req.json();
    console.log('Trading bot AI request:', symbol, action);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Fetch current market data from Binance
    const marketDataRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    const marketData = await marketDataRes.json();

    // Fetch recent klines for technical analysis
    const klinesRes = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=100`);
    const klines = await klinesRes.json();

    // Calculate technical indicators
    const closes = klines.map((k: any) => parseFloat(k[4]));
    const highs = klines.map((k: any) => parseFloat(k[2]));
    const lows = klines.map((k: any) => parseFloat(k[3]));
    
    // Simple RSI calculation
    const calculateRSI = (prices: number[], period = 14) => {
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
    };

    const rsi = calculateRSI(closes);
    const currentPrice = parseFloat(marketData.lastPrice);
    const priceChange24h = parseFloat(marketData.priceChangePercent);

    // Prepare context for AI
    const systemPrompt = `Tu es un expert en analyse de marché crypto avec apprentissage continu. Analyse les données techniques réelles et fournis des recommandations précises basées sur:
    - Indicateurs techniques réels (RSI, prix, volumes)
    - Patterns de marché
    - Volatilité et momentum
    
    Réponds de manière structurée avec des paragraphes clairs, sans utiliser d'astérisques (*) pour la mise en forme. Utilise des sauts de ligne pour séparer les sections.`;

    const userPrompt = `Analyse technique pour ${symbol}:

Prix actuel: $${currentPrice}
Variation 24h: ${priceChange24h}%
RSI(14): ${rsi.toFixed(2)}
Volume 24h: $${parseFloat(marketData.volume).toLocaleString()}
Plus haut 24h: $${marketData.highPrice}
Plus bas 24h: $${marketData.lowPrice}

Action: ${action}

Fournis une analyse professionnelle avec:

1. SIGNAL: ACHETER, VENDRE, ou ATTENDRE avec niveau de confiance

2. ANALYSE TECHNIQUE:
- Interprétation du RSI actuel
- Analyse de la tendance des prix
- Évaluation du momentum

3. RECOMMANDATIONS:
- Points d'entrée optimaux
- Stop loss suggéré
- Take profit recommandé
- Gestion de position

4. RISQUES:
- Principaux risques identifiés
- Facteurs de volatilité
- Conditions de marché

Réponds de façon claire et structurée, sans astérisques. Utilise uniquement des données réelles.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error("AI API error");
    }

    const aiData = await aiResponse.json();
    const recommendation = aiData.choices[0].message.content;

    return new Response(
      JSON.stringify({ 
        recommendation,
        marketData: {
          price: marketData.lastPrice,
          change24h: marketData.priceChangePercent,
          volume: marketData.volume
        }
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in trading-bot-ai:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
