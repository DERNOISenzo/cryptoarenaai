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
    capital: '10000',
    riskPercent: '1'
  });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [userSettings, setUserSettings] = useState<any>(null);
  const { toast } = useToast();

  // Load user settings on mount
  useState(() => {
    const loadUserSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', session.user.id)
          .single();

        if (!error && data) {
          setUserSettings(data);
          setFormData(prev => ({
            ...prev,
            capital: data.capital.toString(),
            riskPercent: data.risk_percent_per_trade.toString()
          }));
        }
      }
    };
    loadUserSettings();
  });

  // Check if user can trade (not exceeded max loss)
  const canTrade = !userSettings || 
    parseFloat(userSettings.current_loss_today) < parseFloat(userSettings.max_loss_per_day);

  const calculateRisk = async () => {
    if (!canTrade) {
      toast({
        title: "⛔ Trading bloqué",
        description: `Vous avez atteint votre limite de perte quotidienne (${userSettings.max_loss_per_day}$)`,
        variant: "destructive",
      });
      return;
    }

    if (!formData.entryPrice || !formData.stopLoss || !formData.capital || !formData.riskPercent) {
      toast({
        title: "⚠️ Champs manquants",
        description: "Veuillez remplir tous les champs requis",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('risk-calculator', {
        body: {
          ...formData,
          takeProfit: formData.takeProfit || undefined
        }
      });

      if (error) throw error;

      setResult(data);
      toast({
        title: "✅ Calcul terminé",
        description: "Votre plan de gestion du risque est prêt",
      });
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
          
          {userSettings && (
            <div className="mt-2 p-3 rounded-lg bg-secondary/50">
              <div className="flex items-center justify-between text-sm">
                <span>💰 Capital: ${userSettings.capital}</span>
                <span>📊 Risque/Trade: {userSettings.risk_percent_per_trade}%</span>
                <span className={parseFloat(userSettings.current_loss_today) > 0 ? 'text-warning' : 'text-success'}>
                  📉 Perte aujourd'hui: ${parseFloat(userSettings.current_loss_today).toFixed(2)} / ${userSettings.max_loss_per_day}
                </span>
              </div>
              {!canTrade && (
                <div className="mt-2 p-2 bg-destructive/20 rounded text-destructive text-sm font-semibold">
                  ⛔ Trading bloqué - Limite de perte quotidienne atteinte
                </div>
              )}
            </div>
          )}
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
              <Label>Capital Total ($)</Label>
              <Input
                type="number"
                step="100"
                value={formData.capital}
                onChange={(e) => setFormData({ ...formData, capital: e.target.value })}
                placeholder="10000"
              />
            </div>
            <div>
              <Label>Risque par Trade (%)</Label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                max="5"
                value={formData.riskPercent}
                onChange={(e) => setFormData({ ...formData, riskPercent: e.target.value })}
                placeholder="1"
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
              <Label>Take Profit ($) - Optionnel</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.takeProfit}
                onChange={(e) => setFormData({ ...formData, takeProfit: e.target.value })}
                placeholder="Optionnel"
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
              <Card className="p-4 bg-primary/10 border-primary">
                <h4 className="font-semibold mb-3">📊 Taille de Position Recommandée</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Montant à risquer ({result.riskPercent}%):</span>
                    <span className="font-bold">${result.riskAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taille de position:</span>
                    <span className="font-bold text-primary">${result.positionSize}</span>
                  </div>
                  {result.multiExitPlan && (
                    <div className="mt-3 p-3 bg-secondary/30 rounded">
                      <p className="text-sm font-semibold mb-2">Plan de sortie progressif:</p>
                      <ul className="text-sm space-y-1">
                        {result.multiExitPlan.map((exit: any, idx: number) => (
                          <li key={idx}>
                            • {exit.percent}% à TP{idx + 1} (${exit.price}) = ${exit.amount}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Card>

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