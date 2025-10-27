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
  BookOpen
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AlertsManager from "@/components/AlertsManager";
import TradingBotAI from "./TradingBotAI";
import TradeJournal from "./TradeJournal";
import Header from "./Header";
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
  targetDuration?: number; // in minutes
  onBack: () => void;
}

interface Analysis {
  signal: "LONG" | "SHORT" | "NEUTRAL";
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
}

const TradingDashboard = ({ crypto, cryptoName, tradeType: initialTradeType = 'swing', onBack }: TradingDashboardProps) => {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [news, setNews] = useState<any[]>([]);
  const [tweets, setTweets] = useState<any[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [tradeJournalOpen, setTradeJournalOpen] = useState(false);
  const [tradeType, setTradeType] = useState<'scalp' | 'swing' | 'long'>(initialTradeType);
  const [targetDuration, setTargetDuration] = useState<number>(0); // in minutes
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Duration options based on trade type
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
  
  // Reset target duration when trade type changes
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
      // Load analysis from edge function
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('crypto-analysis', {
        body: { symbol: crypto, tradeType, targetDuration }
      });

      if (analysisError) throw analysisError;

      // Load news from edge function
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

      // Transform the data to match our interface
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
      };
      
      setAnalysis(transformedAnalysis);
      setLoading(false);
      
      toast({
        title: "✅ Analyse terminée",
        description: `${crypto} analysé avec des données réelles`,
        duration: 3000
      });
    } catch (error) {
      console.error('Analysis error:', error);
      setLoading(false);
      toast({
        title: "❌ Erreur",
        description: "Impossible de charger l'analyse",
        variant: "destructive",
        duration: 3000
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
  const isShort = analysis.signal === "SHORT";
  const signalColor = isLong ? "success" : isShort ? "danger" : "muted";

  return (
    <div className="min-h-screen bg-background">
      {userId && <Header userId={userId} />}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <Button variant="outline" onClick={onBack} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
            
            {/* Trade Type Selector */}
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
                
                {/* Duration Selector */}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">Durée du Trade:</span>
                  <div className="flex gap-2">
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

        {/* Main Signal Card */}
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
                    isLong ? "bg-success" : isShort ? "bg-danger" : "bg-muted"
                  }`} style={{
                    boxShadow: isLong 
                      ? "0 0 20px hsl(var(--success))"
                      : isShort 
                      ? "0 0 20px hsl(var(--danger))"
                      : "none"
                  }} />
                  <span className="text-muted-foreground">Signal IA</span>
                </div>
                <div className="flex items-center gap-4">
                  {isLong ? (
                    <TrendingUp className="w-12 h-12 text-success" />
                  ) : isShort ? (
                    <TrendingDown className="w-12 h-12 text-danger" />
                  ) : (
                    <Activity className="w-12 h-12 text-muted" />
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
                              <p className="max-w-xs">Pourcentage de concordance entre les multiples indicateurs techniques analysés. Plus de 60% = forte conviction du signal.</p>
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
                              <p className="max-w-xs">Levier calculé selon la volatilité ATR et la force de la tendance. Volatilité faible + tendance forte = levier plus élevé acceptable.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <p className="text-2xl font-bold">{analysis.leverage}x</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs text-muted-foreground">Risk/Reward</p>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="w-3 h-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Ratio gain potentiel / perte potentielle. Un ratio de 1.7 signifie que vous pouvez gagner 1.7x plus que ce que vous risquez avec le Stop Loss.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <p className="text-2xl font-bold">1:{analysis.riskReward.toFixed(1)}</p>
                    </div>
                    {analysis.timeHorizon && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs text-muted-foreground">Horizon</p>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="w-3 h-3 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">Durée estimée pour atteindre le Take Profit, calculée selon l'ATR et la distance du TP.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <p className="text-xl font-bold">{analysis.timeHorizon.estimate}</p>
                        <p className="text-xs text-muted-foreground uppercase">{analysis.timeHorizon.type}</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-secondary/30 border-border">
                <div className="flex items-start gap-3">
                  <Target className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div className="space-y-3 text-sm flex-1">
                    <h3 className="font-semibold text-base mb-2">Niveaux de Take Profit</h3>
                    
                    {analysis.takeProfit1 && analysis.takeProfit2 && analysis.takeProfit3 ? (
                      <>
                        <div className="flex justify-between items-center p-2 bg-success/10 rounded border border-success/20">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">TP1 (Conservateur):</span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="w-3 h-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Premier objectif - Prenez 30-50% de vos profits ici pour sécuriser des gains rapides.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <span className="font-bold text-success">${analysis.takeProfit1.toFixed(2)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center p-2 bg-success/10 rounded border border-success/30">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">TP2 (Cible principale):</span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="w-3 h-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Objectif principal - Prenez 40-50% de vos profits ici. Calculé avec ATR optimisé.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <span className="font-bold text-success">${analysis.takeProfit2.toFixed(2)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center p-2 bg-success/10 rounded border border-success/40">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">TP3 (Étendu):</span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="w-3 h-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Objectif ambitieux - Laissez courir 10-20% de votre position pour maximiser les gains en cas de forte tendance.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <span className="font-bold text-success">${analysis.takeProfit3.toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Take Profit:</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="w-3 h-3 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">Prix cible pour prendre vos bénéfices, calculé avec ATR × 2.0 pour les tendances fortes, × 1.5 pour les tendances modérées.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <span className="font-semibold text-success">${analysis.takeProfit.toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center p-2 bg-danger/10 rounded border border-danger/20 mt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Stop Loss:</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="w-3 h-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Prix où couper vos pertes pour limiter le risque. Ajusté selon le type de trade sélectionné.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <span className="font-bold text-danger">${analysis.stopLoss.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </Card>

        {/* Indicators Grid */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="p-6 bg-card border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">RSI (14)</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Relative Strength Index - Mesure la force d'une tendance. &lt;30 = Survente (opportunité d'achat), &gt;70 = Surachat (risque de correction). Calculé sur 14 périodes.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-3xl font-bold">{analysis.indicators.rsi.toFixed(1)}</p>
            <Badge variant={analysis.indicators.rsi < 30 ? "default" : analysis.indicators.rsi > 70 ? "destructive" : "secondary"}>
              {analysis.indicators.rsi < 30 ? "Survente" : analysis.indicators.rsi > 70 ? "Surachat" : "Neutre"}
            </Badge>
          </Card>

          <Card className="p-6 bg-card border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">MACD</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Moving Average Convergence Divergence - Indique le momentum. Positif = tendance haussière, Négatif = tendance baissière. Croisement de la ligne de signal = changement potentiel de tendance.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-2xl font-bold">{analysis.indicators.macd}</p>
            <Badge variant={analysis.indicators.macd === "Haussier" ? "default" : "destructive"}>
              {analysis.indicators.macd}
            </Badge>
          </Card>

          <Card className="p-6 bg-card border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Bollinger Bands</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Bandes de Bollinger - Canaux de volatilité. Prix proche bande basse = survente potentielle, proche bande haute = surachat potentiel. Calculées avec écart-type de 2.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-2xl font-bold">{analysis.indicators.bb}</p>
            <Badge variant="secondary">{analysis.indicators.bb}</Badge>
          </Card>

          <Card className="p-6 bg-card border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">ATR (14)</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Average True Range - Mesure la volatilité. Plus élevé = marché volatil (utiliser levier faible). Plus bas = marché stable (levier plus élevé acceptable). Calculé sur 14 périodes.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-3xl font-bold">{analysis.indicators.atr.toFixed(0)}</p>
            <Badge variant="outline">Volatilité</Badge>
          </Card>
        </div>

        {/* AI Trading Bot */}
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

        {/* Alerts Manager */}
        <AlertsManager 
          symbol={crypto} 
          cryptoName={cryptoName}
          currentPrice={analysis.price} 
        />

        {/* Trade Journal Integration */}
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/30">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Journal de Trading</h3>
              <p className="text-sm text-muted-foreground">
                Enregistrez vos trades pour améliorer vos performances avec le moteur d'apprentissage
              </p>
            </div>
            <Button 
              onClick={() => setTradeJournalOpen(true)}
              className="gap-2"
              size="lg"
            >
              <BookOpen className="w-4 h-4" />
              Enregistrer ce Trade
            </Button>
          </div>
        </Card>

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

        {/* News Section */}
        {news.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Newspaper className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Actualités Crypto</h3>
              <Badge variant="secondary">{news.length}</Badge>
            </div>
            <div className="space-y-3">
              {news.slice(0, 5).map((item, idx) => (
                <a
                  key={idx}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Badge 
                      variant={item.sentiment === 'positive' ? 'default' : item.sentiment === 'negative' ? 'destructive' : 'outline'}
                      className="mt-1"
                    >
                      {item.sentiment === 'positive' ? '🟢' : item.sentiment === 'negative' ? '🔴' : '⚪'}
                    </Badge>
                    <div className="flex-1">
                      <h4 className="font-medium leading-tight mb-1">{item.title}</h4>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{item.source}</span>
                        <span>•</span>
                        <span>{new Date(item.published).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </Card>
        )}

        {/* Tweets Section */}
        {tweets.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Twitter className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Tweets Récents</h3>
              <Badge variant="secondary">{tweets.length}</Badge>
            </div>
            <div className="space-y-3">
              {tweets.slice(0, 5).map((tweet, idx) => (
                <div key={idx} className="p-4 bg-secondary/30 rounded-lg">
                  <p className="text-sm leading-relaxed mb-2">{tweet.text}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{new Date(tweet.created).toLocaleDateString('fr-FR')}</span>
                    <span>❤️ {tweet.likes}</span>
                    <span>🔄 {tweet.retweets}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Recommendation */}
        <Card className="p-6 bg-card border-l-4 border-l-primary">
          <div className="flex gap-4">
            <AlertTriangle className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Recommandation de l'IA</h3>
              <p className="text-muted-foreground leading-relaxed">
                {analysis.recommendation}. L'analyse multi-timeframes (1h, 4h, 1j) suggère une position{" "}
                <span className={`font-bold text-${signalColor}`}>{analysis.signal}</span>{" "}
                avec un niveau de confiance de {analysis.confidence.toFixed(1)}%.
                Le levier recommandé de {analysis.leverage}x est calculé en fonction de la volatilité actuelle (ATR).
              </p>
              <p className="text-sm text-muted-foreground italic">
                ⚠️ Cette analyse est fournie à titre informatif. Toujours faire ses propres recherches et utiliser une gestion de risque appropriée.
              </p>
            </div>
          </div>
        </Card>
        </div>
      </div>
    </div>
  );
};

export default TradingDashboard;
