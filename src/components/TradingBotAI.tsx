import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, TrendingUp, Globe, Calculator } from "lucide-react";
import RiskCalculator from "./RiskCalculator";

interface TradingBotAIProps {
  symbol: string;
  cryptoName: string;
  analysisData: {
    signal: string;
    price: number;
    stopLoss: number;
    takeProfit: number;
    leverage: number;
  };
  onAnalyzeNow: () => void;
}

const TradingBotAI = ({ symbol, cryptoName, analysisData, onAnalyzeNow }: TradingBotAIProps) => {
  const [riskCalcOpen, setRiskCalcOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Brain className="w-6 h-6 text-primary" />
          <h3 className="text-xl font-bold">Actions Intelligentes - {cryptoName}</h3>
        </div>

        <p className="text-sm text-muted-foreground">
          Outils avancés pour optimiser votre trading
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Button 
            onClick={onAnalyzeNow}
            variant="default"
            className="h-auto py-4 flex-col gap-2"
          >
            <TrendingUp className="w-6 h-6" />
            <div className="text-center">
              <p className="font-semibold">Analyser Maintenant</p>
              <p className="text-xs opacity-80">Données fraîches</p>
            </div>
          </Button>
          
          <Button 
            onClick={() => navigate('/market-analysis')}
            variant="outline"
            className="h-auto py-4 flex-col gap-2"
          >
            <Globe className="w-6 h-6" />
            <div className="text-center">
              <p className="font-semibold">Opportunités Globales</p>
              <p className="text-xs opacity-80">Marché complet</p>
            </div>
          </Button>
          
          <Button 
            onClick={() => setRiskCalcOpen(true)}
            variant="outline"
            className="h-auto py-4 flex-col gap-2"
          >
            <Calculator className="w-6 h-6" />
            <div className="text-center">
              <p className="font-semibold">Calculer Mon Risque</p>
              <p className="text-xs opacity-80">Simulateur</p>
            </div>
          </Button>
        </div>
      </Card>

      <RiskCalculator
        open={riskCalcOpen}
        onOpenChange={setRiskCalcOpen}
        initialData={{
          entryPrice: analysisData.price,
          stopLoss: analysisData.stopLoss,
          takeProfit: analysisData.takeProfit,
          leverage: analysisData.leverage
        }}
      />
    </>
  );
};

export default TradingBotAI;
