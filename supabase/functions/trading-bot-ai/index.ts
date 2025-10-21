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

    // Prepare context for AI
    const systemPrompt = `Tu es un bot de trading crypto expert et intelligent qui apprend continuellement du marché. 
    Tu analyses les données de marché en temps réel et fournis des recommandations basées sur :
    - L'analyse technique (RSI, MACD, moyennes mobiles, volumes)
    - Les tendances du marché
    - Les patterns de prix historiques
    - La volatilité et les risques
    
    Tu dois continuellement améliorer tes stratégies en apprenant des patterns passés.
    Fournis des recommandations claires et justifiées pour ${action}.`;

    const userPrompt = `Analyse ces données de marché pour ${symbol}:
    
    Prix actuel: ${marketData.lastPrice}
    Variation 24h: ${marketData.priceChangePercent}%
    Volume 24h: ${marketData.volume}
    Plus haut 24h: ${marketData.highPrice}
    Plus bas 24h: ${marketData.lowPrice}
    
    Données historiques récentes (100 dernières heures):
    ${JSON.stringify(klines.slice(-10))}
    
    Action demandée: ${action}
    
    Fournis une analyse détaillée et une recommandation avec:
    1. Signal (ACHETER/VENDRE/ATTENDRE)
    2. Niveau de confiance (0-100%)
    3. Points d'entrée recommandés
    4. Stop loss suggéré
    5. Take profit suggéré
    6. Justification de la recommandation
    7. Risques identifiés`;

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
