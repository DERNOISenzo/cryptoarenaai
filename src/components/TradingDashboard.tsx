import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowLeft, 
  Activity, 
  Target,
  AlertTriangle,
  Brain,
  Sparkles,
  Newspaper,
  Twitter,
  Info,
  BookOpen,
  DollarSign
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AlertsManager from "@/components/AlertsManager";
import TradingBotAI from "./TradingBotAI";
import TradeJournal from "./TradeJournal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TradingDashboardProps {
  crypto: string;
  cryptoName: string;
  tradeType?: 'scalp' | 'swing' | 'long';
  targetDuration?: number;
  onBack: () => void;
}

interface Analysis {
  signal: "LONG" | "SHORT";
  confidence: number;
  leverage: number;
  price: number;
  change24h: number;
  indicators: {
    rsi: number;
    macd: string;
    bb: string;
    atr: number;
  };
  recommendation: string;
  takeProfit: number;
  takeProfit1?: number;
  takeProfit2?: number;
  takeProfit3?: number;
  stopLoss: number;
  riskReward: number;
  timeHorizon?: {
    estimate: string;
    type: string;
    hours: number;
    confidence: number;
  };
  positionSizing?: {
    capital: number;
    riskPercent: number;
    positionSize: number;
    margin: number;
    riskAmount: number;
    tp1Profit: number;
    tp2Profit: number;
    tp3Profit: number;
    exitPlan?: {
      tp1: { percent: number; profit: number; action: string };
      tp2: { percent: number; profit: number; action: string };
      tp3: { percent: number; profit: number; action: string };
    };
    dailyRiskStatus?: {
      currentLoss: number;
      maxLoss: number;
      remaining: number;
      tradeRisk: number;
      afterThisTrade: number;
      status: string;
    };
    note: string;
  };
}

const TradingDashboard = ({ crypto, cryptoName, tradeType: initialTradeType = 'swing', onBack }: TradingDashboardProps) => {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [news, setNews] = useState<any[]>([]);
  const [tweets, setTweets] = useState<any[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [tradeJournalOpen, setTradeJournalOpen] = useState(false);
  const [tradeType, setTradeType] = useState<'scalp' | 'swing' | 'long'>(initialTradeType);
  const [targetDuration, setTargetDuration] = useState<number>(0);
  const [capitalPercent, setCapitalPercent] = useState<number>(100);
  const [userPreferences, setUserPreferences] = useState<{style: 'scalp' | 'swing' | 'long', loaded: boolean}>({style: 'swing', loaded: false});
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const getDurationOptions = () => {
    switch (tradeType) {
      case 'scalp':
        return [
          { label: '15 minutes', value: 15 },
          { label: '30 minutes', value: 30 },
          { label: '1 heure', value: 60 },
          { label: '2 heures', value: 120 },
        ];
      case 'swing':
        return [
          { label: '4 heures', value: 240 },
          { label: '12 heures', value: 720 },
          { label: '1 jour', value: 1440 },
          { label: '2 jours', value: 2880 },
        ];
      case 'long':
        return [
          { label: '1 semaine', value: 10080 },
          { label: '2 semaines', value: 20160 },
          { label: '1 mois', value: 43200 },
          { label: '3 mois', value: 129600 },
        ];
      default:
        return [];
    }
  };
  
  useEffect(() => {
    const options = getDurationOptions();
    if (options.length > 0 && targetDuration === 0) {
      setTargetDuration(options[0].value);
    } else if (options.length > 0) {
      // Vérifier que targetDuration est dans les options disponibles
      const validOption = options.find(opt => opt.value === targetDuration);
      if (!validOption) {
        setTargetDuration(options[0].value);
      }
    }
  }, [tradeType]);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        
        // Charger les préférences de l'utilisateur
        try {
          const { data: settings } = await supabase
            .from('user_settings')
            .select('preferred_trade_style')
            .eq('user_id', session.user.id)
            .maybeSingle();
          
          if (settings && settings.preferred_trade_style && !userPreferences.loaded) {
            const style = settings.preferred_trade_style as 'scalp' | 'swing' | 'long';
            setTradeType(style);
            setUserPreferences({style, loaded: true});
          }
        } catch (error) {
          console.error('Error loading user preferences:', error);
        }
      } else {
        navigate("/auth");
      }
    };
    loadUser();
  }, [navigate]);

  useEffect(() => {
    if (targetDuration > 0) {
      loadAnalysis();
    }
  }, [crypto, tradeType, targetDuration]);

  const loadAnalysis = async () => {
    setLoading(true);
    
    try {
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('crypto-analysis', {
        body: { symbol: crypto, tradeType, targetDuration, capitalPercent }
      });

      if (analysisError) throw analysisError;

      const baseAsset = crypto.replace('USDT', '').replace('USDC', '').replace('BTC', '').replace('ETH', '');
      const { data: newsData, error: newsError } = await supabase.functions.invoke('crypto-news', {
        body: { symbol: crypto, baseAsset }
      });

      if (newsError) {
        console.error('News error:', newsError);
      } else {
        setNews(newsData?.news || []);
        setTweets(newsData?.tweets || []);
      }

      const transformedAnalysis: Analysis = {
        signal: analysisData.analysis.signal,
        confidence: analysisData.analysis.confidence,
        leverage: analysisData.analysis.leverage,
        price: analysisData.analysis.price,
        change24h: analysisData.analysis.change24h,
        indicators: {
          rsi: analysisData.analysis.indicators.rsi14,
          macd: analysisData.analysis.indicators.macdHist > 0 ? "Haussier" : "Baissier",
          bb: analysisData.analysis.price < analysisData.analysis.indicators.bbLower * 1.01 ? "Survente" : 
              analysisData.analysis.price > analysisData.analysis.indicators.bbUpper * 0.99 ? "Surachat" : "Neutre",
          atr: analysisData.analysis.indicators.atr14,
        },
        recommendation: analysisData.analysis.recommendation,
        takeProfit: analysisData.analysis.takeProfit,
        takeProfit1: analysisData.analysis.takeProfit1,
        takeProfit2: analysisData.analysis.takeProfit2,
        takeProfit3: analysisData.analysis.takeProfit3,
        stopLoss: analysisData.analysis.stopLoss,
        riskReward: analysisData.analysis.riskReward,
        timeHorizon: analysisData.analysis.timeHorizon,
        positionSizing: analysisData.analysis.positionSizing
      };
      
      setAnalysis(transformedAnalysis);
      setLoading(false);
      
      toast({
        title: "✅ Analyse terminée",
        description: `${crypto} analysé avec données réelles`,
        duration: 3000
      });
    } catch (error: any) {
      console.error('Analysis error:', error);
      setLoading(false);
      toast({
        title: "❌ Erreur",
        description: error.message || "Impossible de charger l'analyse",
        variant: "destructive",
        duration: 5000
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Brain className="w-16 h-16 text-primary mx-auto animate-pulse" />
          <h2 className="text-2xl font-bold">Analyse en cours...</h2>
          <p className="text-muted-foreground">
            L'IA analyse {crypto} sur tous les indicateurs
          </p>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const isLong = analysis.signal === "LONG";
  const signalColor = isLong ? "success" : "danger";

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <Button variant="outline" onClick={onBack} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
            
            <Card className="p-3">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">Type de Trade:</span>
                  <div className="flex gap-2">
                    <Button
                      variant={tradeType === 'scalp' ? 'default' : 'outline'}
                      onClick={() => setTradeType('scalp')}
                      size="sm"
                    >
                      🎯 Scalp
                    </Button>
                    <Button
                      variant={tradeType === 'swing' ? 'default' : 'outline'}
                      onClick={() => setTradeType('swing')}
                      size="sm"
                    >
                      📊 Swing
                    </Button>
                    <Button
                      variant={tradeType === 'long' ? 'default' : 'outline'}
                      onClick={() => setTradeType('long')}
                      size="sm"
                    >
                      💎 Long Terme
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">Durée du Trade:</span>
                  <div className="flex gap-2 flex-wrap">
                    {getDurationOptions().map((option) => (
                      <Button
                        key={option.value}
                        variant={targetDuration === option.value ? 'default' : 'outline'}
                        onClick={() => setTargetDuration(option.value)}
                        size="sm"
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <label htmlFor="capitalPercent" className="text-sm font-medium">% du Capital:</label>
                  <input
                    id="capitalPercent"
                    type="number"
                    min="1"
                    max="100"
                    value={capitalPercent}
                    onChange={(e) => setCapitalPercent(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-20 px-3 py-1 text-sm border border-border rounded-md bg-background"
                  />
                  <Button
                    onClick={loadAnalysis}
                    size="sm"
                    variant="default"
                  >
                    Enregistrer
                  </Button>
                </div>
                
                <div className="flex items-center gap-3">
                  <label htmlFor="targetDuration" className="text-sm font-medium">Durée du Trade:</label>
                  <input
                    id="targetDuration"
                    type="number"
                    min="0"
                    max="10080"
                    value={targetDuration}
                    onChange={(e) => setTargetDuration(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-28 px-3 py-1 text-sm border border-border rounded-md bg-background"
                    placeholder="en minutes"
                  />
                  <span className="text-xs text-muted-foreground">
                    (0 = auto, 15 = 15min, 60 = 1h, 1440 = 1j)
                  </span>
                </div>
              </div>
            </Card>
            
            <Button onClick={loadAnalysis} className="gap-2 bg-primary">
              <Sparkles className="w-4 h-4" />
              Actualiser
            </Button>
          </div>

        <Card className="p-8 border-2 border-primary/50 bg-gradient-to-br from-card to-secondary/50 shadow-2xl">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h1 className="text-4xl font-bold mb-2">{crypto}</h1>
                <div className="flex items-baseline gap-4">
                  <span className="text-5xl font-bold">${analysis.price.toFixed(2)}</span>
                  <Badge variant={analysis.change24h >= 0 ? "default" : "destructive"} className="text-lg px-3 py-1">
                    {analysis.change24h >= 0 ? "+" : ""}{analysis.change24h.toFixed(2)}%
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full animate-pulse ${
                    isLong ? "bg-success" : "bg-danger"
                  }`} style={{
                    boxShadow: isLong 
                      ? "0 0 20px hsl(var(--success))"
                      : "0 0 20px hsl(var(--danger))"
                  }} />
                  <span className="text-muted-foreground">Signal IA</span>
                </div>
                <div className="flex items-center gap-4">
                  {isLong ? (
                    <TrendingUp className="w-12 h-12 text-success" />
                  ) : (
                    <TrendingDown className="w-12 h-12 text-danger" />
                  )}
                  <div>
                    <h2 className={`text-4xl font-bold text-${signalColor}`}>
                      {analysis.signal}
                    </h2>
                    <p className="text-muted-foreground">Position recommandée</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Card className="p-6 bg-secondary/30 border-border">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Niveau de confiance</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{analysis.confidence.toFixed(1)}%</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="w-3 h-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Concordance entre les indicateurs techniques, analyse fondamentale et sentiment. Ajusté selon les incohérences détectées.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${
                          isLong ? "from-success to-primary" : "from-danger to-destructive"
                        } transition-all duration-1000`}
                        style={{ width: `${analysis.confidence}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs text-muted-foreground">Levier suggéré</p>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="w-3 h-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Calculé selon la durée cible, volatilité ATR et force de tendance.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <p className="text-2xl font-bold">{analysis.leverage}x</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs text-muted-foreground">Risk/Reward</p>
                      </div>
                      <p className="text-2xl font-bold">1:{analysis.riskReward.toFixed(1)}</p>
                    </div>
                    {analysis.timeHorizon && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs text-muted-foreground">Horizon</p>
                        </div>
                        <p className="text-xl font-bold">{analysis.timeHorizon.estimate}</p>
                        <p className="text-xs text-muted-foreground uppercase">{analysis.timeHorizon.type}</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </Card>

          {/* Daily Risk Status - Full Width */}
          {analysis.positionSizing?.dailyRiskStatus && (
            <Card className={`p-6 border-2 ${
              analysis.positionSizing.dailyRiskStatus.status === 'WARNING' 
                ? 'border-warning/50 bg-warning/10' 
                : 'border-success/30 bg-success/5'
            }`}>
              <div className="flex items-start gap-4">
                <AlertTriangle className={`w-6 h-6 mt-0.5 ${
                  analysis.positionSizing.dailyRiskStatus.status === 'WARNING' 
                    ? 'text-warning' 
                    : 'text-success'
                }`} />
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-4">État du Risque Journalier</h3>
                  <div className="grid md:grid-cols-4 gap-6">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Perte actuelle</p>
                      <p className="text-2xl font-bold">${analysis.positionSizing.dailyRiskStatus.currentLoss.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Limite journalière</p>
                      <p className="text-2xl font-bold">${analysis.positionSizing.dailyRiskStatus.maxLoss.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Risque ce trade</p>
                      <p className="text-2xl font-bold text-warning">${analysis.positionSizing.dailyRiskStatus.tradeRisk.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Reste disponible</p>
                      <p className="text-2xl font-bold text-success">${analysis.positionSizing.dailyRiskStatus.remaining.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Exit Plan - Full Width */}
          <Card className="p-6 bg-secondary/30 border-border">
            <div className="flex items-start gap-3">
              <Target className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
              <div className="space-y-4 flex-1">
                <h3 className="font-bold text-xl mb-4">Plan de Sortie avec Montants en $</h3>
                
                {analysis.takeProfit1 && analysis.takeProfit2 && analysis.takeProfit3 && analysis.positionSizing ? (
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="p-4 bg-success/10 rounded-lg border border-success/20">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-sm">TP1 (50%)</span>
                        </div>
                        <p className="text-xl font-mono font-bold">${analysis.takeProfit1.toFixed(4)}</p>
                        {analysis.positionSizing.exitPlan && (
                          <>
                            <p className="text-success font-bold text-2xl">
                              +${analysis.positionSizing.exitPlan.tp1.profit.toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {analysis.positionSizing.exitPlan.tp1.action}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="p-4 bg-success/10 rounded-lg border border-success/20">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-sm">TP2 (30%)</span>
                        </div>
                        <p className="text-xl font-mono font-bold">${analysis.takeProfit2.toFixed(4)}</p>
                        {analysis.positionSizing.exitPlan && (
                          <>
                            <p className="text-success font-bold text-2xl">
                              +${analysis.positionSizing.exitPlan.tp2.profit.toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {analysis.positionSizing.exitPlan.tp2.action}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="p-4 bg-success/10 rounded-lg border border-success/20">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-sm">TP3 (20%)</span>
                        </div>
                        <p className="text-xl font-mono font-bold">${analysis.takeProfit3.toFixed(4)}</p>
                        {analysis.positionSizing.exitPlan && (
                          <>
                            <p className="text-success font-bold text-2xl">
                              +${analysis.positionSizing.exitPlan.tp3.profit.toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {analysis.positionSizing.exitPlan.tp3.action}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="p-4 bg-danger/10 rounded-lg border border-danger/20">
                      <div className="space-y-2">
                        <span className="font-semibold text-sm">Stop Loss</span>
                        <p className="text-xl font-mono font-bold">${analysis.stopLoss.toFixed(4)}</p>
                        {analysis.positionSizing && (
                          <p className="text-danger font-bold text-2xl">
                            -${analysis.positionSizing.riskAmount.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>

                    {analysis.positionSizing && (
                      <div className="md:col-span-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
                        <div className="flex items-start gap-2 mb-2">
                          <DollarSign className="w-5 h-5 text-primary mt-0.5" />
                          <p className="font-semibold">Taille de Position</p>
                        </div>
                        <div className="grid md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Position</p>
                            <p className="text-lg font-mono font-bold">{analysis.positionSizing.positionSize.toFixed(4)} {crypto.replace('USDT', '')}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Marge requise</p>
                            <p className="text-lg font-bold">${analysis.positionSizing.margin.toFixed(2)} (Levier {analysis.leverage}x)</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Note</p>
                            <p className="text-sm">{analysis.positionSizing.note}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Aucun niveau de sortie défini pour ce signal</p>
                )}
              </div>
            </div>
          </Card>
          
          <div className="grid md:grid-cols-4 gap-4">
            <Card className="p-6 bg-gradient-to-br from-primary/10 via-card to-accent/10 hover:shadow-xl hover:scale-105 transition-all duration-300 border-2 border-primary/20">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold text-foreground uppercase tracking-wider">RSI (14)</span>
                  </div>
                  <Badge 
                    className="text-lg px-4 py-1.5 font-bold shadow-lg"
                    variant={
                      analysis.indicators.rsi < 30 ? "default" : 
                      analysis.indicators.rsi > 70 ? "destructive" : "secondary"
                    }
                  >
                    {analysis.indicators.rsi.toFixed(1)}
                  </Badge>
                </div>
                <div className="w-full h-4 bg-muted/40 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className={`h-full transition-all duration-500 shadow-lg ${
                      analysis.indicators.rsi < 30 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                      analysis.indicators.rsi > 70 ? "bg-gradient-to-r from-rose-500 to-rose-400" : "bg-gradient-to-r from-amber-500 to-amber-400"
                    }`}
                    style={{ width: `${analysis.indicators.rsi}%` }}
                  />
                </div>
                <p className="text-base font-bold text-center">
                  {analysis.indicators.rsi < 30 ? "🟢 Survendu" : 
                   analysis.indicators.rsi > 70 ? "🔴 Suracheté" : "🟡 Neutre"}
                </p>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-primary/10 via-card to-accent/10 hover:shadow-xl hover:scale-105 transition-all duration-300 border-2 border-primary/20">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-foreground uppercase tracking-wider">MACD</span>
                </div>
                <Badge 
                  className="text-lg px-4 py-2 font-bold w-full justify-center shadow-lg"
                  variant={analysis.indicators.macd === "Haussier" ? "default" : "destructive"}
                >
                  {analysis.indicators.macd}
                </Badge>
                <p className="text-base font-bold text-center mt-3">
                  {analysis.indicators.macd === "Haussier" ? "📈 Momentum Positif" : "📉 Momentum Négatif"}
                </p>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-primary/10 via-card to-accent/10 hover:shadow-xl hover:scale-105 transition-all duration-300 border-2 border-primary/20">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-foreground uppercase tracking-wider">Bollinger</span>
                </div>
                <Badge 
                  className="text-lg px-4 py-2 font-bold w-full justify-center shadow-lg"
                  variant={
                    analysis.indicators.bb === "Survente" ? "default" : 
                    analysis.indicators.bb === "Surachat" ? "destructive" : "secondary"
                  }
                >
                  {analysis.indicators.bb}
                </Badge>
                <p className="text-base font-bold text-center mt-3">
                  {analysis.indicators.bb === "Survente" ? "🟢 Zone d'Achat" : 
                   analysis.indicators.bb === "Surachat" ? "🔴 Zone de Vente" : "🟡 Zone Neutre"}
                </p>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-primary/10 via-card to-accent/10 hover:shadow-xl hover:scale-105 transition-all duration-300 border-2 border-primary/20">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-foreground uppercase tracking-wider">Volatilité</span>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-black text-primary">${analysis.indicators.atr.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-2 font-semibold uppercase">
                    ATR (14 périodes)
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Actions Intelligentes - Full Width */}
          <TradingBotAI 
            symbol={crypto}
            cryptoName={cryptoName}
            analysisData={{
              signal: analysis.signal,
              price: analysis.price,
              stopLoss: analysis.stopLoss,
              takeProfit: analysis.takeProfit,
              leverage: analysis.leverage
            }}
            onAnalyzeNow={loadAnalysis}
          />
          
          {/* Alertes Prix - Full Width */}
          <AlertsManager symbol={crypto} cryptoName={cryptoName} currentPrice={analysis.price} />
          
          {/* Enregistrer le Trade - Full Width avec fond vert foncé transparent */}
          <Button 
            onClick={() => setTradeJournalOpen(true)} 
            size="lg"
            className="w-full gap-3 bg-success/80 hover:bg-success/90 text-white font-bold text-lg py-8 shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-success/50"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--success) / 0.8), hsl(var(--success) / 0.6))',
              backdropFilter: 'blur(10px)'
            }}
          >
            <BookOpen className="w-6 h-6" />
            Enregistrer le Trade
          </Button>

          {/* News Section - Full Width */}
          {news.length > 0 && (
            <Card className="p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Newspaper className="w-5 h-5" />
                Actualités Récentes
              </h3>
              <div className="space-y-3">
                {news.slice(0, 5).map((item: any, idx: number) => (
                  <a 
                    key={idx} 
                    href={item.url || '#'} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block p-4 bg-secondary/30 rounded-lg border border-border hover:border-primary transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1 hover:text-primary transition-colors">{item.title}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                        {item.source && (
                          <p className="text-xs text-muted-foreground mt-2">Source: {item.source}</p>
                        )}
                      </div>
                      {item.sentiment && (
                        <Badge 
                          className="font-bold px-3 py-1.5 text-white shadow-md"
                          style={{
                            backgroundColor: 
                              item.sentiment.toLowerCase().includes('très positif') || item.sentiment.toLowerCase().includes('very positive') ? '#10b981' :
                              item.sentiment.toLowerCase().includes('positif') || item.sentiment.toLowerCase().includes('positive') ? '#22c55e' :
                              item.sentiment.toLowerCase().includes('très négatif') || item.sentiment.toLowerCase().includes('very negative') ? '#dc2626' :
                              item.sentiment.toLowerCase().includes('négatif') || item.sentiment.toLowerCase().includes('negative') ? '#ef4444' :
                              item.sentiment.toLowerCase().includes('neutre') || item.sentiment.toLowerCase().includes('neutral') ? '#64748b' :
                              '#94a3b8'
                          }}
                        >
                          {item.sentiment}
                        </Badge>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </Card>
          )}

          {/* Tweets Section */}
          {tweets.length > 0 && (
            <Card className="p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Twitter className="w-5 h-5" />
                Sentiment Twitter
              </h3>
              <div className="space-y-3">
                {tweets.slice(0, 5).map((tweet: any, idx: number) => (
                  <div key={idx} className="p-4 bg-secondary/30 rounded-lg border border-border">
                    <p className="text-sm mb-2">{tweet.text}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{tweet.author}</span>
                      {tweet.sentiment && (
                        <Badge variant={
                          tweet.sentiment === 'positive' ? 'default' : 
                          tweet.sentiment === 'negative' ? 'destructive' : 'secondary'
                        } className="text-xs">
                          {tweet.sentiment}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-8 bg-gradient-to-br from-primary/5 to-secondary/10 border-primary/20">
            <div className="flex items-start gap-4">
              <Brain className="w-8 h-8 text-primary mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-2xl mb-4">Recommandation Finale de l'IA</h3>
                <div className="prose prose-sm max-w-none space-y-4">
                  {analysis.recommendation.split('\n\n').map((paragraph, idx) => {
                    const lines = paragraph.split('\n');
                    return (
                      <div key={idx}>
                        {lines.map((line, lineIdx) => {
                          // Mettre en gras les titres (lignes courtes en début ou avec ':')
                          const isBold = line.length < 50 && (lineIdx === 0 || line.includes(':') || line.match(/^[A-Z]/));
                          return (
                            <p key={lineIdx} className={isBold ? "font-bold text-base" : "text-sm leading-relaxed"}>
                              {line}
                            </p>
                          );
                        })}
                        {idx < analysis.recommendation.split('\n\n').length - 1 && (
                          <hr className="my-3 border-t border-border/50" />
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-6 pt-4 border-t border-border/50">
                  ⚠️ Cette analyse est fournie à titre informatif uniquement et ne constitue pas un conseil en investissement.
                  Faites toujours vos propres recherches avant de prendre une décision de trading.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {analysis && (
        <TradeJournal
          open={tradeJournalOpen}
          onOpenChange={setTradeJournalOpen}
          analysisData={{
            symbol: crypto,
            cryptoName: cryptoName,
            signal: analysis.signal,
            entryPrice: analysis.price,
            takeProfit: analysis.takeProfit,
            stopLoss: analysis.stopLoss,
            leverage: analysis.leverage
          }}
        />
      )}
    </div>
  );
};

export default TradingDashboard;
