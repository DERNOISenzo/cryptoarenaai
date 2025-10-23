import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calculator, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RiskCalculatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    leverage: number;
  };
}

const RiskCalculator = ({ open, onOpenChange, initialData }: RiskCalculatorProps) => {
  const [formData, setFormData] = useState({
    entryPrice: initialData?.entryPrice?.toString() || '',
    stopLoss: initialData?.stopLoss?.toString() || '',
    takeProfit: initialData?.takeProfit?.toString() || '',
    leverage: initialData?.leverage?.toString() || '1',
    capital: '1000'
  });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const calculateRisk = async () => {
    if (!formData.entryPrice || !formData.stopLoss || !formData.takeProfit || !formData.leverage || !formData.capital) {
      toast({
        title: "⚠️ Champs manquants",
        description: "Veuillez remplir tous les champs",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('risk-calculator', {
        body: formData
      });

      if (error) throw error;

      setResult(data);
    } catch (error) {
      console.error('Risk calculator error:', error);
      toast({
        title: "❌ Erreur",
        description: "Impossible de calculer le risque",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Calculateur de Risque
          </DialogTitle>
          <DialogDescription>
            Calculez votre exposition et votre ratio risque/récompense
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Prix d'entrée ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.entryPrice}
                onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Capital ($)</Label>
              <Input
                type="number"
                step="100"
                value={formData.capital}
                onChange={(e) => setFormData({ ...formData, capital: e.target.value })}
                placeholder="1000"
              />
            </div>
            <div>
              <Label>Stop Loss ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.stopLoss}
                onChange={(e) => setFormData({ ...formData, stopLoss: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Take Profit ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.takeProfit}
                onChange={(e) => setFormData({ ...formData, takeProfit: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="col-span-2">
              <Label>Levier (x)</Label>
              <Input
                type="number"
                min="1"
                max="125"
                value={formData.leverage}
                onChange={(e) => setFormData({ ...formData, leverage: e.target.value })}
                placeholder="1"
              />
            </div>
          </div>

          <Button onClick={calculateRisk} disabled={loading} className="w-full">
            {loading ? 'Calcul en cours...' : 'Calculer'}
          </Button>

          {result && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Type de position:</span>
                <Badge variant={result.isLong ? "default" : "destructive"}>
                  {result.isLong ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                  {result.isLong ? 'LONG' : 'SHORT'}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold">Niveau de risque:</span>
                <Badge variant={
                  result.riskLevel === 'LOW' ? 'default' : 
                  result.riskLevel === 'MEDIUM' ? 'secondary' : 
                  'destructive'
                }>
                  {result.riskLevel === 'LOW' ? '🟢 FAIBLE' : 
                   result.riskLevel === 'MEDIUM' ? '🟡 MOYEN' : 
                   '🔴 ÉLEVÉ'}
                </Badge>
              </div>

              <Card className="p-4 bg-secondary/30">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Position avec levier</p>
                    <p className="text-xl font-bold">${result.leveragedPosition}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Prix de liquidation</p>
                    <p className="text-xl font-bold">${result.liquidationPrice}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-danger/10 border-danger">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-danger" />
                  <span className="font-semibold text-danger">Perte potentielle</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-danger">${result.potentialLoss}</span>
                  <Badge variant="destructive">{result.potentialLossPercent}%</Badge>
                </div>
              </Card>

              <Card className="p-4 bg-success/10 border-success">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-success" />
                  <span className="font-semibold text-success">Gain potentiel</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-success">${result.potentialGain}</span>
                  <Badge className="bg-success">{result.potentialGainPercent}%</Badge>
                </div>
              </Card>

              <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
                <span className="font-semibold">Ratio Risk/Reward:</span>
                <span className="text-2xl font-bold">1:{result.riskRewardRatio}</span>
              </div>

              <Card className="p-4 bg-secondary/30">
                <h4 className="font-semibold mb-3">Recommandations:</h4>
                <ul className="space-y-2">
                  {result.recommendations.map((rec: string, idx: number) => (
                    <li key={idx} className="text-sm">{rec}</li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RiskCalculator;