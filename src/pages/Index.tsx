import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrendingUp, Bot, Zap, Shield } from "lucide-react";
import TradingDashboard from "@/components/TradingDashboard";
import CryptoSearch from "@/components/CryptoSearch";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import Header from "@/components/Header";

const Index = () => {
  const [started, setStarted] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState<string>("");
  const [cryptoName, setCryptoName] = useState<string>("");
  const [tradeType, setTradeType] = useState<'scalp' | 'swing' | 'long'>('swing');
  const [targetDuration, setTargetDuration] = useState<number>(0); // in minutes
  const [session, setSession] = useState<Session | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleStart = () => {
    setStarted(true);
  };

  const handleSelect = (symbol: string, name: string) => {
    setSelectedCrypto(symbol);
    setCryptoName(name);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Handle URL parameters for direct navigation with trade type
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTradeType = params.get('tradeType') as 'scalp' | 'swing' | 'long' | null;
    const urlCrypto = params.get('crypto');
    
    if (urlTradeType) {
      setTradeType(urlTradeType);
    }
    if (urlCrypto) {
      setSelectedCrypto(urlCrypto);
      setStarted(true);
    }
  }, []);

  if (selectedCrypto) {
    return <TradingDashboard 
      crypto={selectedCrypto} 
      cryptoName={cryptoName} 
      tradeType={tradeType}
      targetDuration={targetDuration}
      onBack={() => {
        setSelectedCrypto("");
        setCryptoName("");
      }} 
    />;
  }

  if (started) {
    return (
      <div className="min-h-screen bg-background">
        {session && <Header userId={session.user.id} />}
        <div className="p-4">
          <CryptoSearch onSelect={handleSelect} onBack={() => setStarted(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header userId={session?.user.id} />
      <div className="flex items-center justify-center p-4 min-h-screen">
      <div className="max-w-4xl w-full space-y-8 animate-slide-up">
        <div className="text-center space-y-4">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <Bot className="w-24 h-24 text-primary animate-pulse-glow" />
              <Zap className="w-8 h-8 text-accent absolute -top-2 -right-2" />
            </div>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            CryptoArena AI
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground">
            Bot de Trading Crypto Intelligent
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 space-y-6 shadow-2xl">
          <h2 className="text-2xl font-semibold text-center mb-6">
            🚀 Votre Assistant Trading IA
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-3 p-4 bg-secondary/50 rounded-xl border border-primary/20">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-success" />
                <h3 className="font-semibold">Analyses Précises</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Prédictions Long/Short basées sur des données temps réel et algorithmes avancés
              </p>
            </div>

            <div className="space-y-3 p-4 bg-secondary/50 rounded-xl border border-accent/20">
              <div className="flex items-center gap-2">
                <Zap className="w-6 h-6 text-accent" />
                <h3 className="font-semibold">Alertes Instantanées</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Notifications sur les mouvements importants et opportunités de trading
              </p>
            </div>

            <div className="space-y-3 p-4 bg-secondary/50 rounded-xl border border-danger/20">
              <div className="flex items-center gap-2">
                <Shield className="w-6 h-6 text-danger" />
                <h3 className="font-semibold">Gestion du Risque</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Recommandations de levier intelligentes et calculs Stop-Loss/Take-Profit
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h3 className="text-lg font-semibold text-center">Fonctionnalités Clés</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>Analyse multi-indicateurs (RSI, MACD, Bollinger Bands, ATR...)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>Données en temps réel depuis Binance</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>News et actualités crypto intégrées</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>Recommandations de levier optimisées selon la volatilité</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>Système d'alertes prix personnalisables</span>
              </li>
            </ul>
          </div>

          <div className="pt-6">
            <Button 
              onClick={session ? handleStart : () => navigate("/auth")} 
              className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-success to-primary hover:opacity-90 transition-opacity"
              disabled={!session}
            >
              {session ? "Commencer l'Analyse" : "Connectez-vous pour commencer"}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            ⚠️ Le trading comporte des risques. Utilisez toujours une gestion de risque appropriée.
          </p>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Index;
