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
    const { entryPrice, stopLoss, takeProfit, leverage, capital, riskPercent } = await req.json();

    // Validate inputs
    if (!entryPrice || !stopLoss || !capital || !riskPercent) {
      throw new Error('Missing required parameters: entryPrice, stopLoss, capital, riskPercent');
    }

    const entry = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);
    const tp = takeProfit ? parseFloat(takeProfit) : null;
    const lev = leverage ? parseInt(leverage) : 1;
    const cap = parseFloat(capital);
    const risk = parseFloat(riskPercent);

    if (entry <= 0 || sl <= 0 || cap <= 0 || risk <= 0 || risk > 10) {
      throw new Error('Invalid values: all must be positive and risk <= 10%');
    }

    // Determine direction
    const isLong = sl < entry;

    // Calculate risk per unit
    const riskPerUnit = Math.abs(entry - sl);
    const riskPercentOfEntry = (riskPerUnit / entry) * 100;

    // Calculate position size based on risk percentage
    const riskAmount = (cap * risk) / 100;
    const positionSize = riskAmount / riskPerUnit;
    const positionValue = positionSize * entry;

    // Calculate with leverage
    const leveragedPosition = positionValue * lev;

    // Calculate potential loss (if SL is hit)
    const potentialLoss = riskAmount * lev;
    const potentialLossPercent = (potentialLoss / cap) * 100;

    // Calculate potential gain (if TP is provided)
    let potentialGain = 0;
    let potentialGainPercent = 0;
    let riskRewardRatio = 0;
    let multiExitPlan = null;

    if (tp) {
      const rewardPerUnit = Math.abs(tp - entry);
      potentialGain = positionSize * rewardPerUnit * lev;
      potentialGainPercent = (potentialGain / cap) * 100;
      riskRewardRatio = rewardPerUnit / riskPerUnit;

      // Generate multi-exit plan (3 TPs)
      const tp1Distance = rewardPerUnit * 0.33;
      const tp2Distance = rewardPerUnit * 0.66;
      const tp3Distance = rewardPerUnit;

      multiExitPlan = [
        {
          percent: 50,
          price: (isLong ? entry + tp1Distance : entry - tp1Distance).toFixed(2),
          amount: (positionValue * 0.5).toFixed(2)
        },
        {
          percent: 30,
          price: (isLong ? entry + tp2Distance : entry - tp2Distance).toFixed(2),
          amount: (positionValue * 0.3).toFixed(2)
        },
        {
          percent: 20,
          price: tp.toFixed(2),
          amount: (positionValue * 0.2).toFixed(2)
        }
      ];
    }

    // Calculate liquidation price (approximate)
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
      riskPercent: risk.toFixed(1),
      riskAmount: riskAmount.toFixed(2),
      positionSize: positionValue.toFixed(2),
      leveragedPosition: leveragedPosition.toFixed(2),
      potentialLoss: potentialLoss.toFixed(2),
      potentialLossPercent: potentialLossPercent.toFixed(2),
      potentialGain: potentialGain.toFixed(2),
      potentialGainPercent: potentialGainPercent.toFixed(2),
      riskRewardRatio: riskRewardRatio > 0 ? riskRewardRatio.toFixed(2) : 'N/A',
      liquidationPrice: liquidationPrice.toFixed(2),
      riskLevel: riskLevel,
      isLong: isLong,
      multiExitPlan,
      recommendations: generateRecommendations(lev, riskRewardRatio, potentialLossPercent, risk)
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
  lossPercent: number,
  riskPercent: number
): string[] {
  const recommendations: string[] = [];

  if (riskPercent > 2) {
    recommendations.push("⚠️ Risque par trade élevé (>2%) - Considérez de réduire");
  } else if (riskPercent <= 1) {
    recommendations.push("✅ Risque par trade conservateur (<= 1%)");
  }

  if (leverage > 10) {
    recommendations.push("⚠️ Levier très élevé - Risque de liquidation important");
  } else if (leverage > 5) {
    recommendations.push("⚡ Levier modéré - Surveillez votre position");
  } else {
    recommendations.push("✅ Levier raisonnable - Risque contrôlé");
  }

  if (riskReward > 0) {
    if (riskReward < 1.5) {
      recommendations.push("❌ Ratio R:R insuffisant - Cherchez un meilleur point d'entrée");
    } else if (riskReward < 2) {
      recommendations.push("⚠️ Ratio R:R acceptable mais pourrait être amélioré");
    } else if (riskReward >= 3) {
      recommendations.push("🎯 Excellent ratio R:R - Configuration favorable");
    } else {
      recommendations.push("✅ Bon ratio R:R - Configuration valide");
    }
  }

  if (lossPercent > 50) {
    recommendations.push("🚨 Perte potentielle trop élevée - Réduisez votre levier");
  } else if (lossPercent > 25) {
    recommendations.push("⚠️ Perte potentielle significative - Soyez prudent");
  } else if (lossPercent < 10) {
    recommendations.push("✅ Perte potentielle bien contrôlée");
  }

  recommendations.push("💡 Déplacez votre SL au break-even après TP1");
  recommendations.push("📊 Envisagez une sortie progressive sur plusieurs TPs");
  
  return recommendations;
}