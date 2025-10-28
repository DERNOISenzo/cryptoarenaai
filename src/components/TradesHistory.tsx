import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, TrendingUp, TrendingDown, Filter, Download } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";

interface Trade {
  id: string;
  symbol: string;
  crypto_name: string;
  signal: string;
  entry_price: number;
  exit_price: number | null;
  take_profit: number;
  stop_loss: number;
  leverage: number;
  result_percent: number | null;
  result_amount: number | null;
  status: string;
  created_at: string;
  closed_at: string | null;
  duration_minutes: number | null;
}

const TradesHistory = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [filteredTrades, setFilteredTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSignal, setFilterSignal] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchSymbol, setSearchSymbol] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadTrades();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [trades, filterSignal, filterStatus, searchSymbol]);

  const loadTrades = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTrades(data || []);
    } catch (error) {
      console.error('Load trades error:', error);
      toast({
        title: "❌ Erreur",
        description: "Impossible de charger les trades",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...trades];

    if (filterSignal !== "all") {
      filtered = filtered.filter(t => t.signal === filterSignal);
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter(t => t.status === filterStatus);
    }

    if (searchSymbol) {
      filtered = filtered.filter(t => 
        t.symbol.toLowerCase().includes(searchSymbol.toLowerCase()) ||
        t.crypto_name.toLowerCase().includes(searchSymbol.toLowerCase())
      );
    }

    setFilteredTrades(filtered);
  };

  const calculateKPIs = () => {
    const closedTrades = trades.filter(t => t.status === 'closed' && t.result_percent !== null);
    
    if (closedTrades.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        avgProfit: 0,
        avgLoss: 0,
        totalPnL: 0,
        bestTrade: 0,
        worstTrade: 0,
        payoffRatio: 0
      };
    }

    const wins = closedTrades.filter(t => (t.result_percent || 0) > 0);
    const losses = closedTrades.filter(t => (t.result_percent || 0) < 0);
    
    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.result_amount || 0), 0);
    const avgProfit = wins.length > 0 
      ? wins.reduce((sum, t) => sum + Math.abs(t.result_percent || 0), 0) / wins.length 
      : 0;
    const avgLoss = losses.length > 0 
      ? losses.reduce((sum, t) => sum + Math.abs(t.result_percent || 0), 0) / losses.length 
      : 0;

    return {
      totalTrades: closedTrades.length,
      winRate: (wins.length / closedTrades.length) * 100,
      avgProfit,
      avgLoss,
      totalPnL,
      bestTrade: Math.max(...closedTrades.map(t => t.result_percent || 0)),
      worstTrade: Math.min(...closedTrades.map(t => t.result_percent || 0)),
      payoffRatio: avgLoss > 0 ? avgProfit / avgLoss : 0
    };
  };

  const getEquityCurveData = () => {
    const closedTrades = trades
      .filter(t => t.status === 'closed' && t.result_amount !== null)
      .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime());

    let equity = 0;
    return closedTrades.map((trade, index) => {
      equity += trade.result_amount || 0;
      return {
        trade: index + 1,
        equity: Math.round(equity * 100) / 100,
        date: new Date(trade.closed_at!).toLocaleDateString('fr-FR')
      };
    });
  };

  const getTradeDistribution = () => {
    const closedTrades = trades.filter(t => t.status === 'closed' && t.result_percent !== null);
    
    const ranges = [
      { label: '< -10%', min: -Infinity, max: -10, count: 0 },
      { label: '-10% à -5%', min: -10, max: -5, count: 0 },
      { label: '-5% à 0%', min: -5, max: 0, count: 0 },
      { label: '0% à 5%', min: 0, max: 5, count: 0 },
      { label: '5% à 10%', min: 5, max: 10, count: 0 },
      { label: '> 10%', min: 10, max: Infinity, count: 0 }
    ];

    closedTrades.forEach(trade => {
      const percent = trade.result_percent || 0;
      const range = ranges.find(r => percent >= r.min && percent < r.max);
      if (range) range.count++;
    });

    return ranges;
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Crypto', 'Signal', 'Entry', 'Exit', 'TP', 'SL', 'Leverage', 'Result %', 'Result $', 'Status'];
    const rows = filteredTrades.map(t => [
      new Date(t.created_at).toLocaleDateString('fr-FR'),
      t.crypto_name,
      t.signal,
      t.entry_price,
      t.exit_price || '',
      t.take_profit,
      t.stop_loss,
      t.leverage,
      t.result_percent || '',
      t.result_amount || '',
      t.status
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const kpis = calculateKPIs();
  const equityCurve = getEquityCurveData();
  const distribution = getTradeDistribution();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <h1 className="text-3xl font-bold">Journal de Trades</h1>
          <Button onClick={exportToCSV} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exporter CSV
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Total Trades</p>
            <p className="text-2xl font-bold">{kpis.totalTrades}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Win Rate</p>
            <p className="text-2xl font-bold text-success">{kpis.winRate.toFixed(1)}%</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">PnL Total</p>
            <p className={`text-2xl font-bold ${kpis.totalPnL >= 0 ? 'text-success' : 'text-danger'}`}>
              ${kpis.totalPnL.toFixed(2)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Payoff Ratio</p>
            <p className="text-2xl font-bold">{kpis.payoffRatio.toFixed(2)}</p>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Equity Curve */}
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">Courbe d'Équité</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={equityCurve}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="trade" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2} name="PnL ($)" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Distribution */}
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">Distribution des Résultats</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={distribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" name="Trades" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Rechercher par crypto..."
              value={searchSymbol}
              onChange={(e) => setSearchSymbol(e.target.value)}
              className="max-w-xs"
            />
            <Select value={filterSignal} onValueChange={setFilterSignal}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Signal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="LONG">LONG</SelectItem>
                <SelectItem value="SHORT">SHORT</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="open">Ouvert</SelectItem>
                <SelectItem value="closed">Fermé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Trades List */}
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">Historique ({filteredTrades.length})</h3>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredTrades.map(trade => (
              <div key={trade.id} className="border border-border rounded-lg p-4 hover:bg-secondary/30 transition-colors">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Crypto</p>
                    <p className="font-semibold">{trade.crypto_name}</p>
                    <p className="text-xs text-muted-foreground">{trade.symbol}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Signal</p>
                    <div className="flex items-center gap-2">
                      {trade.signal === 'LONG' ? (
                        <TrendingUp className="w-4 h-4 text-success" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-danger" />
                      )}
                      <p className="font-semibold">{trade.signal}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{trade.leverage}x</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Prix</p>
                    <p className="text-sm">Entry: ${trade.entry_price.toFixed(2)}</p>
                    {trade.exit_price && (
                      <p className="text-sm">Exit: ${trade.exit_price.toFixed(2)}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Résultat</p>
                    {trade.result_percent !== null ? (
                      <>
                        <p className={`font-bold ${trade.result_percent >= 0 ? 'text-success' : 'text-danger'}`}>
                          {trade.result_percent >= 0 ? '+' : ''}{trade.result_percent.toFixed(2)}%
                        </p>
                        {trade.result_amount !== null && (
                          <p className="text-sm text-muted-foreground">
                            ${trade.result_amount.toFixed(2)}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">En cours...</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="text-sm">{new Date(trade.created_at).toLocaleDateString('fr-FR')}</p>
                    {trade.closed_at && (
                      <p className="text-xs text-muted-foreground">
                        Fermé: {new Date(trade.closed_at).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default TradesHistory;
