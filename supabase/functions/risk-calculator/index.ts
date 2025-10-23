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
    const { entryPrice, stopLoss, takeProfit, leverage, capital } = await req.json();

    // Validate inputs
    if (!entryPrice || !stopLoss || !takeProfit || !leverage || !capital) {
      throw new Error('Missing required parameters');
    }

    const entry = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);
    const tp = parseFloat(takeProfit);
    const lev = parseInt(leverage);
    const cap = parseFloat(capital);

    if (entry <= 0 || sl <= 0 || tp <= 0 || lev <= 0 || cap <= 0) {
      throw new Error('All values must be positive');
    }

    // Calculate risk and reward percentages
    const riskPercent = Math.abs((sl - entry) / entry) * 100;
    const rewardPercent = Math.abs((tp - entry) / entry) * 100;

    // Calculate position size based on capital
    const positionSize = cap;

    // Calculate with leverage
    const leveragedPosition = positionSize * lev;

    // Calculate potential loss (if SL is hit)
    const potentialLoss = (riskPercent / 100) * leveragedPosition;
    const potentialLossPercent = (potentialLoss / cap) * 100;

    // Calculate potential gain (if TP is hit)
    const potentialGain = (rewardPercent / 100) * leveragedPosition;
    const potentialGainPercent = (potentialGain / cap) * 100;

    // Calculate risk/reward ratio
    const riskRewardRatio = rewardPercent / riskPercent;

    // Calculate liquidation price (approximate)
    const isLong = tp > entry;
    const liquidationPrice = isLong 
      ? entry * (1 - (1 / lev) * 0.9) // 90% of margin before liquidation
      : entry * (1 + (1 / lev) * 0.9);

    // Risk assessment
    let riskLevel = 'LOW';
    if (lev > 10 || potentialLossPercent > 50) riskLevel = 'HIGH';
    else if (lev > 5 || potentialLossPercent > 25) riskLevel = 'MEDIUM';

    const result = {
      entryPrice: entry,
      stopLoss: sl,
      takeProfit: tp,
      leverage: lev,
      capital: cap,
      positionSize: positionSize.toFixed(2),
      leveragedPosition: leveragedPosition.toFixed(2),
      potentialLoss: potentialLoss.toFixed(2),
      potentialLossPercent: potentialLossPercent.toFixed(2),
      potentialGain: potentialGain.toFixed(2),
      potentialGainPercent: potentialGainPercent.toFixed(2),
      riskRewardRatio: riskRewardRatio.toFixed(2),
      liquidationPrice: liquidationPrice.toFixed(2),
      riskLevel: riskLevel,
      isLong: isLong,
      recommendations: generateRecommendations(lev, riskRewardRatio, potentialLossPercent)
    };

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Risk calculator error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateRecommendations(
  leverage: number,
  riskReward: number,
  lossPercent: number
): string[] {
  const recommendations: string[] = [];

  if (leverage > 10) {
    recommendations.push("⚠️ Levier très élevé - Risque de liquidation important");
  } else if (leverage > 5) {
    recommendations.push("⚡ Levier modéré - Surveillez votre position");
  } else {
    recommendations.push("✅ Levier raisonnable - Risque contrôlé");
  }

  if (riskReward < 1.5) {
    recommendations.push("❌ Ratio R:R insuffisant - Cherchez un meilleur point d'entrée");
  } else if (riskReward < 2) {
    recommendations.push("⚠️ Ratio R:R acceptable mais pourrait être amélioré");
  } else if (riskReward >= 3) {
    recommendations.push("🎯 Excellent ratio R:R - Configuration favorable");
  } else {
    recommendations.push("✅ Bon ratio R:R - Configuration valide");
  }

  if (lossPercent > 50) {
    recommendations.push("🚨 Perte potentielle trop élevée - Réduisez votre levier");
  } else if (lossPercent > 25) {
    recommendations.push("⚠️ Perte potentielle significative - Soyez prudent");
  } else if (lossPercent < 10) {
    recommendations.push("✅ Perte potentielle bien contrôlée");
  }

  recommendations.push("💡 Utilisez toujours un Stop Loss pour limiter vos pertes");
  
  return recommendations;
}