import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CryptoResult {
  symbol: string;
  name: string;
  baseAsset: string;
  quoteAsset: string;
  price: number;
  change24h: number;
  volume24h: number;
}

interface CryptoSearchProps {
  onSelect: (symbol: string, name: string) => void;
  onBack: () => void;
}

const CryptoSearch = ({ onSelect, onBack }: CryptoSearchProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [quoteAsset, setQuoteAsset] = useState("USDT");
  const [results, setResults] = useState<CryptoResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const { toast } = useToast();

  const quotes = ["USDT", "USDC", "BTC", "ETH", "BNB"];

  const formatVolume = (volume: number) => {
    if (volume >= 1e9) return `$${(volume / 1e9).toFixed(2)}B`;
    if (volume >= 1e6) return `$${(volume / 1e6).toFixed(2)}M`;
    if (volume >= 1e3) return `$${(volume / 1e3).toFixed(2)}K`;
    return `$${volume.toFixed(2)}`;
  };

  const getCryptoLogo = (baseAsset: string) => {
    return `https://cryptologos.cc/logos/thumbs/${baseAsset.toLowerCase()}.png?v=032`;
  };

  useEffect(() => {
    searchCryptos(true);
    
    // Refresh data every 10 seconds
    const interval = setInterval(() => {
      searchCryptos(false);
    }, 10000);
    
    return () => clearInterval(interval);
  }, [quoteAsset, searchQuery]);

  const searchCryptos = async (showLoading: boolean = true) => {
    if (showLoading) {
      setLoading(true);
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('crypto-search', {
        body: { query: searchQuery, quoteAsset }
      });

      if (error) throw error;

      setResults(data.results || []);
      
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "❌ Erreur",
        description: "Impossible de charger les cryptos",
        variant: "destructive",
        duration: 3000
      });
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const handleSearch = () => {
    searchCryptos(true);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Recherche de Cryptos</h1>
          <Button variant="outline" onClick={onBack}>
            ← Retour
          </Button>
        </div>

        {/* Search and Filters */}
        <Card className="p-6 space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Rechercher par nom ou symbole (ex: BTC, Bitcoin, Ethereum...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch}>
              <Search className="w-5 h-5" />
            </Button>
          </div>

          {/* Quote Asset Filter */}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Filtrer par quote asset:</label>
            <div className="flex gap-2 flex-wrap">
              {quotes.map((quote) => (
                <Button
                  key={quote}
                  variant={quoteAsset === quote ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQuoteAsset(quote)}
                >
                  {quote}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Results */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="mt-4 text-muted-foreground">Chargement...</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {results.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  Aucun résultat trouvé. Essayez une autre recherche.
                </p>
              </Card>
            ) : (
              results.map((crypto) => (
                <Card
                  key={crypto.symbol}
                  className="p-4 hover:border-primary transition-all cursor-pointer"
                  onClick={() => onSelect(crypto.symbol, crypto.name)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 flex items-center gap-4">
                      <img 
                        src={getCryptoLogo(crypto.baseAsset)} 
                        alt={crypto.name}
                        className="w-12 h-12 rounded-full"
                        onError={(e) => {
                          e.currentTarget.src = "https://via.placeholder.com/48?text=" + crypto.baseAsset;
                        }}
                      />
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-bold">{crypto.name}</h3>
                          <Badge variant="outline">{crypto.symbol}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {crypto.baseAsset}/{crypto.quoteAsset}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-2xl font-bold">
                        ${crypto.price.toFixed(crypto.price < 1 ? 6 : 2)}
                      </p>
                      <div className="flex items-center gap-1 justify-end mt-1">
                        {crypto.change24h >= 0 ? (
                          <TrendingUp className="w-4 h-4 text-success" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-danger" />
                        )}
                        <span className={crypto.change24h >= 0 ? "text-success" : "text-danger"}>
                          {crypto.change24h >= 0 ? "+" : ""}{crypto.change24h.toFixed(2)}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Vol: {formatVolume(crypto.volume24h)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CryptoSearch;
