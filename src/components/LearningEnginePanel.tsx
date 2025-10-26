import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, Target, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

interface LearningStats {
  stats: {
    totalTrades: number;
    winRate: number;
    expectancy: number;
    payoffRatio: number;
    bestSignal: string;
    optimalLeverage: number;
  };
  insights: {
    performance: string;
    recommendations: string[];
    adjustments: {
      rsi_oversold_threshold: number;
      rsi_overbought_threshold: number;
      atr_multiplier_tp: number;
      atr_multiplier_sl: number;
      confidence_threshold: number;
      min_bullish_score: number;
      preferred_signal: string;
      max_leverage: number;
    };
  };
  message: string;
}

const LearningEnginePanel = () => {
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    loadLastUpdate();
  }, []);

  const loadLastUpdate = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('analysis_params')
      .select('updated_at')
      .eq('user_id', user.id)
      .single();

    if (data?.updated_at) {
      setLastUpdate(new Date(data.updated_at).toLocaleDateString('fr-FR'));
    }
  };

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('learning-engine');

      if (error) throw error;

      if (data.message === 'Not enough data') {
        toast({
          title: "⚠️ Données insuffisantes",
          description: `Minimum 10 trades nécessaires. Actuellement: ${data.currentTrades}`,
          variant: "destructive"
        });
        return;
      }

      setStats(data);
      setLastUpdate(new Date().toLocaleDateString('fr-FR'));
      
      toast({
        title: "✅ Analyse terminée",
        description: "Paramètres optimisés enregistrés",
        duration: 3000
      });
    } catch (error) {
      console.error('Learning engine error:', error);
      toast({
        title: "❌ Erreur",
        description: "Impossible d'exécuter l'analyse",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getPerformanceBadge = (performance: string) => {
    switch (performance) {
      case 'excellent':
        return <Badge className="bg-success">Excellent</Badge>;
      case 'good':
        return <Badge className="bg-primary">Bon</Badge>;
      default:
        return <Badge variant="destructive">À améliorer</Badge>;
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-secondary/30">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-primary" />
          <div>
            <h3 className="text-xl font-bold">Moteur d'Apprentissage</h3>
            <p className="text-sm text-muted-foreground">
              {lastUpdate ? `Dernière mise à jour: ${lastUpdate}` : "Aucune analyse effectuée"}
            </p>
          </div>
        </div>
        <Button 
          onClick={runAnalysis} 
          disabled={loading}
          className="gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyse...
            </>
          ) : (
            <>
              <Brain className="w-4 h-4" />
              Lancer l'analyse
            </>
          )}
        </Button>
      </div>

      {stats && (
        <div className="space-y-6">
          {/* Performance Overview */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card className="p-4 bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">Trades analysés</p>
              <p className="text-2xl font-bold">{stats.stats.totalTrades}</p>
            </Card>
            <Card className="p-4 bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">Taux de réussite</p>
              <p className="text-2xl font-bold text-success">{stats.stats.winRate.toFixed(1)}%</p>
            </Card>
            <Card className="p-4 bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">Espérance</p>
              <p className={`text-2xl font-bold ${stats.stats.expectancy >= 0 ? 'text-success' : 'text-danger'}`}>
                {stats.stats.expectancy.toFixed(2)}%
              </p>
            </Card>
            <Card className="p-4 bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">Performance</p>
              <div className="mt-1">{getPerformanceBadge(stats.insights.performance)}</div>
            </Card>
          </div>

          <Separator />

          {/* Recommendations */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Recommandations
            </h4>
            <div className="space-y-2">
              {stats.insights.recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Optimized Parameters */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Paramètres Optimisés
            </h4>
            <div className="grid md:grid-cols-2 gap-3">
              <Card className="p-3 bg-secondary/30">
                <p className="text-xs text-muted-foreground">Seuil de confiance</p>
                <p className="text-lg font-bold">{stats.insights.adjustments.confidence_threshold}%</p>
              </Card>
              <Card className="p-3 bg-secondary/30">
                <p className="text-xs text-muted-foreground">Score haussier min</p>
                <p className="text-lg font-bold">{stats.insights.adjustments.min_bullish_score}/100</p>
              </Card>
              <Card className="p-3 bg-secondary/30">
                <p className="text-xs text-muted-foreground">Levier optimal</p>
                <p className="text-lg font-bold">{stats.insights.adjustments.max_leverage}x</p>
              </Card>
              <Card className="p-3 bg-secondary/30">
                <p className="text-xs text-muted-foreground">Signal préféré</p>
                <p className="text-lg font-bold">{stats.insights.adjustments.preferred_signal}</p>
              </Card>
              <Card className="p-3 bg-secondary/30">
                <p className="text-xs text-muted-foreground">Multiplicateur TP</p>
                <p className="text-lg font-bold">{stats.insights.adjustments.atr_multiplier_tp.toFixed(1)}x ATR</p>
              </Card>
              <Card className="p-3 bg-secondary/30">
                <p className="text-xs text-muted-foreground">Multiplicateur SL</p>
                <p className="text-lg font-bold">{stats.insights.adjustments.atr_multiplier_sl.toFixed(1)}x ATR</p>
              </Card>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="w-4 h-4" />
            <span>Ces paramètres sont automatiquement appliqués à vos prochaines analyses</span>
          </div>
        </div>
      )}

      {!stats && !loading && (
        <div className="text-center py-8 text-muted-foreground">
          <p>Lancez une analyse pour optimiser vos paramètres de trading</p>
          <p className="text-sm mt-2">Minimum 10 trades clôturés requis</p>
        </div>
      )}
    </Card>
  );
};

export default LearningEnginePanel;