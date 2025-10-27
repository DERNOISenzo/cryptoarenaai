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
    if (options.length > 0) {
      setTargetDuration(options[0].value);
    }
  }, [tradeType]);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
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
        body: { symbol: crypto, tradeType, targetDuration }
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

              {/* Daily Risk Status */}
              {analysis.positionSizing?.dailyRiskStatus && (
                <Card className={`p-4 border-2 ${
                  analysis.positionSizing.dailyRiskStatus.status === 'WARNING' 
                    ? 'border-warning/50 bg-warning/10' 
                    : 'border-success/30 bg-success/5'
                }`}>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                      analysis.positionSizing.dailyRiskStatus.status === 'WARNING' 
                        ? 'text-warning' 
                        : 'text-success'
                    }`} />
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-2">État du Risque Journalier</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Perte actuelle</p>
                          <p className="font-bold">${analysis.positionSizing.dailyRiskStatus.currentLoss.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Limite journalière</p>
                          <p className="font-bold">${analysis.positionSizing.dailyRiskStatus.maxLoss.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Risque ce trade</p>
                          <p className="font-bold text-warning">${analysis.positionSizing.dailyRiskStatus.tradeRisk.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Reste disponible</p>
                          <p className="font-bold text-success">${analysis.positionSizing.dailyRiskStatus.remaining.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              <Card className="p-6 bg-secondary/30 border-border">
                <div className="flex items-start gap-3">
                  <Target className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div className="space-y-3 text-sm flex-1">
                    <h3 className="font-semibold text-base mb-2">Plan de Sortie avec Montants en $</h3>
                    
                    {analysis.takeProfit1 && analysis.takeProfit2 && analysis.takeProfit3 && analysis.positionSizing ? (
                      <>
                        <div className="flex justify-between items-start p-3 bg-success/10 rounded border border-success/20">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold">TP1 (50%):</span>
                              <span className="font-mono">${analysis.takeProfit1.toFixed(4)}</span>
                            </div>
                            {analysis.positionSizing.exitPlan && (
                              <>
                                <p className="text-success font-bold text-lg">
                                  +${analysis.positionSizing.exitPlan.tp1.profit.toFixed(2)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {analysis.positionSizing.exitPlan.tp1.action}
                                </p>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-between items-start p-3 bg-success/10 rounded border border-success/20">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold">TP2 (30%):</span>
                              <span className="font-mono">${analysis.takeProfit2.toFixed(4)}</span>
                            </div>
                            {analysis.positionSizing.exitPlan && (
                              <>
                                <p className="text-success font-bold text-lg">
                                  +${analysis.positionSizing.exitPlan.tp2.profit.toFixed(2)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {analysis.positionSizing.exitPlan.tp2.action}
                                </p>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-between items-start p-3 bg-success/10 rounded border border-success/20">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold">TP3 (20%):</span>
                              <span className="font-mono">${analysis.takeProfit3.toFixed(4)}</span>
                            </div>
                            {analysis.positionSizing.exitPlan && (
                              <>
                                <p className="text-success font-bold text-lg">
                                  +${analysis.positionSizing.exitPlan.tp3.profit.toFixed(2)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {analysis.positionSizing.exitPlan.tp3.action}
                                </p>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-danger/10 rounded border border-danger/20">
                          <span className="font-semibold">Stop Loss:</span>
                          <div className="text-right">
                            <span className="font-mono">${analysis.stopLoss.toFixed(4)}</span>
                            {analysis.positionSizing && (
                              <p className="text-danger font-bold">
                                -${analysis.positionSizing.riskAmount.toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>

                        {analysis.positionSizing && (
                          <div className="p-3 bg-primary/10 rounded border border-primary/20 mt-4">
                            <div className="flex items-start gap-2 mb-2">
                              <DollarSign className="w-4 h-4 text-primary mt-0.5" />
                              <p className="text-xs font-semibold">Taille de Position</p>
                            </div>
                            <p className="text-sm">
                              <span className="font-mono font-bold">{analysis.positionSizing.positionSize.toFixed(4)}</span> {crypto.replace('USDT', '')}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Marge requise: ${analysis.positionSizing.margin.toFixed(2)} (Levier {analysis.leverage}x)
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {analysis.positionSizing.note}
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-muted-foreground">Aucun niveau de sortie défini pour ce signal</p>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </Card>

          
          <div className="grid md:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">RSI (14)</span>
                  <Badge variant={
                    analysis.indicators.rsi < 30 ? "default" : 
                    analysis.indicators.rsi > 70 ? "destructive" : "secondary"
                  }>
                    {analysis.indicators.rsi.toFixed(1)}
                  </Badge>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${
                      analysis.indicators.rsi < 30 ? "bg-success" :
                      analysis.indicators.rsi > 70 ? "bg-danger" : "bg-warning"
                    }`}
                    style={{ width: `${analysis.indicators.rsi}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {analysis.indicators.rsi < 30 ? "Survendu ✅" : 
                   analysis.indicators.rsi > 70 ? "Suracheté ⚠️" : "Neutre"}
                </p>
              </div>
            </Card>

            <Card className="p-6">
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">MACD</span>
                <Badge variant={analysis.indicators.macd === "Haussier" ? "default" : "destructive"}>
                  {analysis.indicators.macd}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  Momentum {analysis.indicators.macd === "Haussier" ? "↑" : "↓"}
                </p>
              </div>
            </Card>

            <Card className="p-6">
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Bollinger Bands</span>
                <Badge variant={
                  analysis.indicators.bb === "Survente" ? "default" : 
                  analysis.indicators.bb === "Surachat" ? "destructive" : "secondary"
                }>
                  {analysis.indicators.bb}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {analysis.indicators.bb === "Survente" ? "Zone d'achat ✅" : 
                   analysis.indicators.bb === "Surachat" ? "Zone de vente ⚠️" : "Zone neutre"}
                </p>
              </div>
            </Card>

            <Card className="p-6">
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">ATR (Volatilité)</span>
                <p className="text-2xl font-bold">${analysis.indicators.atr.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">
                  Volatilité moyenne sur 14 périodes
                </p>
              </div>
            </Card>
          </div>

          <div className="flex gap-4">
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
            
            <AlertsManager symbol={crypto} cryptoName={cryptoName} currentPrice={analysis.price} />
            
            <Button 
              onClick={() => setTradeJournalOpen(true)} 
              variant="outline" 
              className="gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Enregistrer le Trade
            </Button>
          </div>

          {/* News Section */}
          {news.length > 0 && (
            <Card className="p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Newspaper className="w-5 h-5" />
                Actualités Récentes
              </h3>
              <div className="space-y-3">
                {news.slice(0, 5).map((item: any, idx: number) => (
                  <div key={idx} className="p-4 bg-secondary/30 rounded-lg border border-border">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">{item.title}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                      </div>
                      {item.sentiment && (
                        <Badge variant={
                          item.sentiment === 'positive' ? 'default' : 
                          item.sentiment === 'negative' ? 'destructive' : 'secondary'
                        }>
                          {item.sentiment}
                        </Badge>
                      )}
                    </div>
                  </div>
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

          <Card className="p-6 bg-primary/5 border-primary/20">
            <div className="flex items-start gap-3">
              <Brain className="w-6 h-6 text-primary mt-1" />
              <div>
                <h3 className="font-bold text-lg mb-2">Recommandation Finale de l'IA</h3>
                <p className="text-sm whitespace-pre-line">{analysis.recommendation}</p>
                <p className="text-xs text-muted-foreground mt-4">
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
