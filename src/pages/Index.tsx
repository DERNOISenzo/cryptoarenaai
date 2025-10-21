import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, Bot, Zap, Shield, Search } from "lucide-react";
import TradingDashboard from "@/components/TradingDashboard";

const Index = () => {
  const [started, setStarted] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const handleStart = () => {
    setStarted(true);
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setSelectedCrypto(searchQuery.trim().toUpperCase());
    }
  };

  if (selectedCrypto) {
    return <TradingDashboard crypto={selectedCrypto} onBack={() => setSelectedCrypto("")} />;
  }

  if (!started) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
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
                  <span>Apprentissage continu basé sur les patterns de marché</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Données en temps réel depuis Binance et autres sources</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Recommandations de levier optimisées selon la volatilité</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Interface claire et intuitive pour tous les niveaux</span>
                </li>
              </ul>
            </div>

            <div className="pt-6">
              <Button 
                onClick={handleStart} 
                className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-success to-primary hover:opacity-90 transition-opacity"
              >
                Commencer l'Analyse
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              ⚠️ Le trading comporte des risques. Utilisez toujours une gestion de risque appropriée.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8 animate-slide-up">
        <div className="text-center space-y-4">
          <Bot className="w-16 h-16 text-primary mx-auto animate-pulse-glow" />
          <h2 className="text-4xl font-bold">Choisissez une Crypto</h2>
          <p className="text-muted-foreground">
            Entrez le nom ou le symbole de la cryptomonnaie à analyser
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 space-y-6 shadow-2xl">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ex: BTC, ETH, BITCOIN, ETHEREUM..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                className="h-12 text-lg bg-secondary border-border"
              />
              <Button 
                onClick={handleSearch}
                className="h-12 px-6 bg-primary hover:bg-primary/90"
              >
                <Search className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {["BTC", "ETH", "SOL", "BNB", "ADA", "XRP", "DOGE", "MATIC"].map((crypto) => (
                <Button
                  key={crypto}
                  variant="outline"
                  onClick={() => setSelectedCrypto(crypto)}
                  className="h-12 border-primary/30 hover:border-primary hover:bg-primary/10"
                >
                  {crypto}
                </Button>
              ))}
            </div>
          </div>

          <Button 
            variant="outline" 
            onClick={() => setStarted(false)}
            className="w-full"
          >
            ← Retour
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
