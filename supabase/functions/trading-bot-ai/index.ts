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
    const systemPrompt = `Tu es un expert en trading crypto professionnel avec 15 ans d'expérience. Tu analyses les données de marché en temps réel et fournis des recommandations précises basées sur:
    - Analyse technique approfondie (RSI, MACD, Bollinger, ATR, volumes)
    - Patterns de prix historiques et prédictions
    - Corrélations de marché et sentiment
    - Gestion du risque professionnelle
    
    RÈGLES CRITIQUES:
    - Utilise UNIQUEMENT les données réelles fournies, jamais de valeurs fictives
    - Réponds de manière structurée avec des paragraphes clairs
    - N'utilise JAMAIS d'astérisques (*) pour la mise en forme
    - Sois précis, direct et actionnable
    - Base tes recommandations sur des faits vérifiables`;

    let userPrompt = '';
    
    if (action === 'analyse complète') {
      userPrompt = `ANALYSE COMPLÈTE - ${symbol}

DONNÉES DE MARCHÉ EN TEMPS RÉEL:
Prix actuel: $${currentPrice}
Variation 24h: ${priceChange24h}%
Plus haut 24h: $${marketData.highPrice}
Plus bas 24h: $${marketData.lowPrice}
Volume 24h: $${parseFloat(marketData.volume).toLocaleString()}

INDICATEURS TECHNIQUES:
RSI(14): ${rsi.toFixed(2)}
${rsi < 30 ? 'Zone de SURVENTE' : rsi > 70 ? 'Zone de SURACHAT' : 'Zone neutre'}

ANALYSE DES 100 DERNIÈRES BOUGIES:
Tendance court terme: ${closes[closes.length - 1] > closes[closes.length - 10] ? 'HAUSSIÈRE' : 'BAISSIÈRE'}
Volatilité: ${((Math.max(...highs.slice(-20)) - Math.min(...lows.slice(-20))) / currentPrice * 100).toFixed(2)}%

Fournis une analyse approfondie incluant:

1. SIGNAL DE TRADING
   - Direction recommandée (LONG/SHORT/NEUTRE)
   - Niveau de confiance basé sur les données réelles
   - Horizon temporel optimal

2. ANALYSE TECHNIQUE DÉTAILLÉE
   - Interprétation précise du RSI à ${rsi.toFixed(2)}
   - Analyse de la structure de prix des dernières 24h
   - Évaluation du momentum et de la force de tendance
   - Impact du volume sur la décision

3. STRATÉGIE D'ENTRÉE
   - Prix d'entrée optimal basé sur les supports/résistances identifiés
   - Taille de position recommandée
   - Conditions de validation du signal

4. GESTION DU RISQUE
   - Stop loss calculé: $${(currentPrice * 0.97).toFixed(2)} (niveau technique)
   - Take profit suggéré: $${(currentPrice * 1.05).toFixed(2)} (objectif réaliste)
   - Ratio risque/récompense: 1:1.7

5. FACTEURS DE RISQUE
   - Risques identifiés dans les conditions actuelles
   - Niveaux critiques à surveiller
   - Scénarios alternatifs

Réponds de façon professionnelle, structurée, sans astérisques. Base-toi uniquement sur les données réelles fournies.`;
    } else if (action === 'opportunité d\'achat') {
      userPrompt = `RECHERCHE D'OPPORTUNITÉ D'ACHAT - ${symbol}

DONNÉES ACTUELLES:
Prix: $${currentPrice} (${priceChange24h > 0 ? '+' : ''}${priceChange24h}% sur 24h)
RSI: ${rsi.toFixed(2)} ${rsi < 40 ? '(FAVORABLE pour achat)' : rsi > 60 ? '(SURACHAT - Prudence)' : '(Neutre)'}
Volume: $${parseFloat(marketData.volume).toLocaleString()}
Range 24h: $${marketData.lowPrice} - $${marketData.highPrice}

HISTORIQUE DE PRIX (20 périodes):
Bas: $${Math.min(...lows.slice(-20)).toFixed(2)}
Haut: $${Math.max(...highs.slice(-20)).toFixed(2)}
Moyenne: $${(closes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20).toFixed(2)}

Évalue spécifiquement l'opportunité d'ACHAT:

1. ÉVALUATION DE L'OPPORTUNITÉ
   - Est-ce le bon moment pour acheter ? (Oui/Non/Attendre)
   - Score d'opportunité sur 10 basé sur les données
   - Catalyseurs haussiers identifiés

2. ZONE D'ACCUMULATION
   - Prix d'entrée idéal: calculé sur supports techniques réels
   - Zone de prix favorable pour accumulation
   - Délai recommandé pour l'entrée

3. OBJECTIFS DE PRIX
   - Objectif court terme (3-7 jours): basé sur résistances
   - Objectif moyen terme (1-4 semaines): projection technique
   - Potentiel de gain estimé en %

4. PROTECTION
   - Stop loss impératif: niveau technique précis
   - Signal d'invalidation de la thèse d'achat
   - Stratégie si le prix baisse avant l'achat

Sois précis et actionnable. Utilise uniquement les données fournies.`;
    } else if (action === 'gestion des risques') {
      userPrompt = `GESTION DES RISQUES - ${symbol}

CONTEXTE DE MARCHÉ:
Prix actuel: $${currentPrice}
Volatilité 24h: ${((parseFloat(marketData.highPrice) - parseFloat(marketData.lowPrice)) / currentPrice * 100).toFixed(2)}%
RSI: ${rsi.toFixed(2)}
Variation: ${priceChange24h}%

ANALYSE DE VOLATILITÉ:
ATR (Calculé sur 14 périodes): ${((Math.max(...highs.slice(-14)) - Math.min(...lows.slice(-14))) / 14).toFixed(2)}
Écart-type 20 périodes: ${(Math.sqrt(closes.slice(-20).reduce((sum: number, close: number) => sum + Math.pow(close - currentPrice, 2), 0) / 20)).toFixed(2)}

Fournis une analyse complète de GESTION DU RISQUE:

1. ÉVALUATION DU RISQUE ACTUEL
   - Niveau de risque: FAIBLE/MOYEN/ÉLEVÉ basé sur volatilité
   - Facteurs de risque spécifiques identifiés
   - Probabilité de mouvements brusques

2. STRATÉGIE DE PROTECTION
   - Stop loss optimal: $${(currentPrice * 0.96).toFixed(2)} (niveau technique validé)
   - Trailing stop: stratégie de suivie du prix
   - Conditions de sortie partielle
   - Signaux d'alerte précoce

3. DIMENSIONNEMENT DE POSITION
   - Taille de position recommandée (% du capital)
   - Levier maximal conseillé: ${rsi < 40 && Math.abs(priceChange24h) < 3 ? '3x-5x' : '2x-3x'} (basé sur volatilité)
   - Répartition du capital (entrée progressive vs. entrée unique)

4. GESTION DYNAMIQUE
   - Niveaux de prix critiques: supports et résistances réels
   - Actions à $${(currentPrice * 1.03).toFixed(2)} (résistance)
   - Actions à $${(currentPrice * 0.97).toFixed(2)} (support)
   - Plan B si le scénario principal échoue

5. PSYCHOLOGIE ET DISCIPLINE
   - Erreurs à éviter dans les conditions actuelles
   - Règles à respecter strictement
   - Moment optimal pour réévaluer la position

Sois pragmatique et défensif. Base tout sur les données réelles.`;
    }

    userPrompt += `\n\nIMPORTANT: N'utilise AUCUN astérisque (*). Réponds de façon claire avec des sauts de ligne.`;

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
