import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TradeStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageProfit: number;
  averageLoss: number;
  expectancy: number;
  payoffRatio: number;
  bestSignal: 'LONG' | 'SHORT';
  worstPattern: string;
  optimalLeverage: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🧠 Learning Engine: Analyzing trade history...');

    // Fetch all closed trades from the last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: trades, error } = await supabase
      .from('trades')
      .select('*')
      .eq('status', 'closed')
      .gte('created_at', ninetyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!trades || trades.length < 10) {
      console.log('Not enough trade data for analysis (minimum 10 trades required)');
      return new Response(JSON.stringify({ 
        message: 'Not enough data',
        requiresMinimum: 10,
        currentTrades: trades?.length || 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate comprehensive statistics
    const stats: TradeStats = {
      totalTrades: trades.length,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      averageProfit: 0,
      averageLoss: 0,
      expectancy: 0,
      payoffRatio: 0,
      bestSignal: 'LONG',
      worstPattern: '',
      optimalLeverage: 5
    };

    let totalProfit = 0;
    let totalLoss = 0;
    const signalStats = { LONG: { wins: 0, total: 0 }, SHORT: { wins: 0, total: 0 } };
    const leveragePerformance: { [key: number]: { profit: number, count: number } } = {};

    trades.forEach(trade => {
      const resultPercent = trade.result_percent || 0;
      
      if (resultPercent > 0) {
        stats.winningTrades++;
        totalProfit += resultPercent;
      } else {
        stats.losingTrades++;
        totalLoss += Math.abs(resultPercent);
      }

      // Track signal performance
      const signal = trade.signal as 'LONG' | 'SHORT';
      if (signalStats[signal]) {
        signalStats[signal].total++;
        if (resultPercent > 0) signalStats[signal].wins++;
      }

      // Track leverage performance
      const leverage = trade.leverage || 5;
      if (!leveragePerformance[leverage]) {
        leveragePerformance[leverage] = { profit: 0, count: 0 };
      }
      leveragePerformance[leverage].profit += resultPercent;
      leveragePerformance[leverage].count++;
    });

    stats.winRate = (stats.winningTrades / stats.totalTrades) * 100;
    stats.averageProfit = stats.winningTrades > 0 ? totalProfit / stats.winningTrades : 0;
    stats.averageLoss = stats.losingTrades > 0 ? totalLoss / stats.losingTrades : 0;
    stats.payoffRatio = stats.averageLoss > 0 ? stats.averageProfit / stats.averageLoss : 0;
    stats.expectancy = (stats.winRate / 100 * stats.averageProfit) - ((1 - stats.winRate / 100) * stats.averageLoss);

    // Determine best signal type
    const longWinRate = signalStats.LONG.total > 0 
      ? (signalStats.LONG.wins / signalStats.LONG.total) * 100 
      : 0;
    const shortWinRate = signalStats.SHORT.total > 0 
      ? (signalStats.SHORT.wins / signalStats.SHORT.total) * 100 
      : 0;
    stats.bestSignal = longWinRate > shortWinRate ? 'LONG' : 'SHORT';

    // Find optimal leverage
    let maxAvgProfit = -Infinity;
    let optimalLev = 5;
    Object.entries(leveragePerformance).forEach(([lev, perf]) => {
      const avgProfit = perf.profit / perf.count;
      if (avgProfit > maxAvgProfit && perf.count >= 3) {
        maxAvgProfit = avgProfit;
        optimalLev = parseInt(lev);
      }
    });
    stats.optimalLeverage = optimalLev;

    // Generate insights and recommendations
    const insights = {
      performance: stats.winRate > 55 ? 'excellent' : stats.winRate > 45 ? 'good' : 'needs_improvement',
      recommendations: [] as string[],
      adjustments: {
        rsi_oversold_threshold: 30,
        rsi_overbought_threshold: 70,
        atr_multiplier_tp: 2.0,
        atr_multiplier_sl: 1.0,
        confidence_threshold: 60,
        min_bullish_score: 8,
        preferred_signal: stats.bestSignal,
        max_leverage: stats.optimalLeverage
      }
    };

    // Generate recommendations
    if (stats.winRate < 50) {
      insights.recommendations.push('Taux de réussite faible - augmenter le seuil de confiance minimum');
      insights.adjustments.confidence_threshold = 65;
      insights.adjustments.min_bullish_score = 10;
    }

    if (stats.payoffRatio < 1.5) {
      insights.recommendations.push('Ratio gain/perte insuffisant - élargir les take-profits');
      insights.adjustments.atr_multiplier_tp = 2.5;
    }

    if (stats.expectancy < 0) {
      insights.recommendations.push('Espérance négative - réduire le levier et augmenter la sélectivité');
      insights.adjustments.max_leverage = Math.max(2, stats.optimalLeverage - 2);
      insights.adjustments.confidence_threshold = 70;
    }

    if (longWinRate > 0 && shortWinRate > 0) {
      if (Math.abs(longWinRate - shortWinRate) > 15) {
        insights.recommendations.push(`Focus sur les positions ${stats.bestSignal} (meilleur taux de réussite)`);
      }
    }

    // Analyze patterns by timeframe (from analysis_data if available)
    const patternAnalysis: { [key: string]: { wins: number, total: number } } = {};
    trades.forEach(trade => {
      if (trade.analysis_data) {
        const data = trade.analysis_data as any;
        const pattern = data.trendAlignment ? 'aligned' : 'divergent';
        if (!patternAnalysis[pattern]) {
          patternAnalysis[pattern] = { wins: 0, total: 0 };
        }
        patternAnalysis[pattern].total++;
        if ((trade.result_percent || 0) > 0) {
          patternAnalysis[pattern].wins++;
        }
      }
    });

    insights.recommendations.push(`Optimal leverage identifié: ${stats.optimalLeverage}x`);
    insights.recommendations.push(`Signal le plus performant: ${stats.bestSignal} (${stats.bestSignal === 'LONG' ? longWinRate.toFixed(1) : shortWinRate.toFixed(1)}%)`);

    console.log('📊 Learning Engine Results:', {
      winRate: stats.winRate.toFixed(2),
      expectancy: stats.expectancy.toFixed(2),
      recommendations: insights.recommendations.length
    });

    // Save or update analysis parameters for this user
    const { data: authData } = await supabase.auth.getUser();
    if (authData.user) {
      const { error: upsertError } = await supabase
        .from('analysis_params')
        .upsert({
          user_id: authData.user.id,
          rsi_oversold_threshold: insights.adjustments.rsi_oversold_threshold,
          rsi_overbought_threshold: insights.adjustments.rsi_overbought_threshold,
          atr_multiplier_tp: insights.adjustments.atr_multiplier_tp,
          atr_multiplier_sl: insights.adjustments.atr_multiplier_sl,
          confidence_threshold: insights.adjustments.confidence_threshold,
          min_bullish_score: insights.adjustments.min_bullish_score,
          preferred_signal: insights.adjustments.preferred_signal,
          max_leverage: insights.adjustments.max_leverage,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (upsertError) {
        console.error('Failed to save analysis params:', upsertError);
      } else {
        console.log('✅ Analysis parameters updated for user');
      }
    }

    return new Response(JSON.stringify({ 
      stats,
      insights,
      patternAnalysis,
      timestamp: new Date().toISOString(),
      message: 'Analysis complete',
      parametersUpdated: !!authData.user
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Learning engine error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});