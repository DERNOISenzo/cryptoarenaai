import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FundamentalData {
  symbol: string;
  name: string;
  marketCap: number;
  fullyDilutedValuation: number | null;
  circulatingSupply: number;
  totalSupply: number | null;
  maxSupply: number | null;
  dilutionRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  inflationRate: number;
  tvl: number | null;
  tvlRank: number | null;
  developerActivity: {
    commits: number;
    contributors: number;
    stars: number;
    score: number;
  } | null;
  onChainMetrics: {
    activeAddresses: number | null;
    transactionCount: number | null;
    networkValue: string;
  };
  fundamentalScore: number;
  breakdown: {
    tokenomicsScore: number;
    activityScore: number;
    liquidityScore: number;
    communityScore: number;
  };
}

// Fetch TVL data from DeFi Llama
async function fetchTVLData(symbol: string): Promise<{ tvl: number | null; rank: number | null }> {
  try {
    const response = await fetch('https://api.llama.fi/protocols');
    const protocols = await response.json();
    
    const protocol = protocols.find((p: any) => 
      p.symbol?.toUpperCase() === symbol.toUpperCase() ||
      p.name?.toUpperCase().includes(symbol.toUpperCase())
    );
    
    if (protocol) {
      return {
        tvl: protocol.tvl || null,
        rank: protocols.findIndex((p: any) => p.slug === protocol.slug) + 1
      };
    }
  } catch (error) {
    console.error('Error fetching TVL data:', error);
  }
  
  return { tvl: null, rank: null };
}

// Fetch GitHub activity (simulated - would need GitHub API token in production)
async function fetchGitHubActivity(projectName: string): Promise<FundamentalData['developerActivity']> {
  try {
    // Common crypto project GitHub repos
    const repoMap: { [key: string]: string } = {
      'BTC': 'bitcoin/bitcoin',
      'ETH': 'ethereum/go-ethereum',
      'BNB': 'bnb-chain/bsc',
      'SOL': 'solana-labs/solana',
      'ADA': 'input-output-hk/cardano-node',
      'DOT': 'paritytech/polkadot',
      'MATIC': 'maticnetwork/bor',
      'AVAX': 'ava-labs/avalanchego',
      'LINK': 'smartcontractkit/chainlink',
      'UNI': 'Uniswap/v3-core'
    };
    
    const repoPath = repoMap[projectName.toUpperCase()];
    if (!repoPath) return null;
    
    const response = await fetch(`https://api.github.com/repos/${repoPath}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) return null;
    
    const repoData = await response.json();
    
    // Fetch recent commits count
    const commitsResponse = await fetch(`https://api.github.com/repos/${repoPath}/commits?per_page=1`, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    let commitsCount = 0;
    if (commitsResponse.ok) {
      const linkHeader = commitsResponse.headers.get('Link');
      if (linkHeader) {
        const match = linkHeader.match(/page=(\d+)>; rel="last"/);
        if (match) commitsCount = parseInt(match[1]);
      }
    }
    
    // Calculate activity score (0-100)
    const score = Math.min(100, 
      (repoData.stargazers_count / 100) * 0.3 +
      (commitsCount / 100) * 0.4 +
      (repoData.subscribers_count / 10) * 0.3
    );
    
    return {
      commits: commitsCount,
      contributors: repoData.subscribers_count || 0,
      stars: repoData.stargazers_count || 0,
      score: Math.round(score)
    };
  } catch (error) {
    console.error('Error fetching GitHub data:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();
    
    if (!symbol) {
      throw new Error('Symbol is required');
    }
    
    const baseName = symbol.replace('USDT', '');
    console.log(`📊 Fundamental Analysis: ${baseName}`);
    
    // Fetch CoinGecko data
    const cgResponse = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&sparkline=false&price_change_percentage=7d');
    const cgCoins = await cgResponse.json();
    
    const coinData = cgCoins.find((c: any) => c.symbol.toUpperCase() === baseName);
    
    if (!coinData) {
      throw new Error('Coin not found in CoinGecko data');
    }
    
    // Fetch detailed coin data
    const detailResponse = await fetch(`https://api.coingecko.com/api/v3/coins/${coinData.id}?localization=false&tickers=false&community_data=true&developer_data=true`);
    const detailData = await detailResponse.json();
    
    // Fetch TVL data
    const { tvl, rank: tvlRank } = await fetchTVLData(baseName);
    
    // Fetch GitHub activity
    const devActivity = await fetchGitHubActivity(baseName);
    
    // Calculate tokenomics metrics
    const circulatingSupply = coinData.circulating_supply || 0;
    const totalSupply = coinData.total_supply || null;
    const maxSupply = coinData.max_supply || null;
    const fullyDilutedValuation = coinData.fully_diluted_valuation || null;
    
    // Calculate dilution risk
    let dilutionRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (totalSupply && circulatingSupply) {
      const circulationRatio = circulatingSupply / totalSupply;
      if (circulationRatio > 0.9) dilutionRisk = 'LOW';
      else if (circulationRatio > 0.7) dilutionRisk = 'MEDIUM';
      else dilutionRisk = 'HIGH';
    }
    
    // Calculate inflation rate (if max supply exists)
    let inflationRate = 0;
    if (maxSupply && circulatingSupply) {
      inflationRate = ((maxSupply - circulatingSupply) / circulatingSupply) * 100;
    }
    
    // On-chain metrics from CoinGecko community data
    const onChainMetrics = {
      activeAddresses: detailData.community_data?.twitter_followers || null,
      transactionCount: null, // Would need blockchain API
      networkValue: tvl ? (tvl > 1000000000 ? 'HIGH' : tvl > 100000000 ? 'MEDIUM' : 'LOW') : 'UNKNOWN'
    };
    
    // SCORING SYSTEM (100 points)
    
    // 1. Tokenomics Score (30 points)
    let tokenomicsScore = 0;
    
    // Dilution risk (15 points)
    if (dilutionRisk === 'LOW') tokenomicsScore += 15;
    else if (dilutionRisk === 'MEDIUM') tokenomicsScore += 8;
    else tokenomicsScore += 3;
    
    // Inflation rate (10 points)
    if (inflationRate === 0) tokenomicsScore += 10; // Deflationary or fixed supply
    else if (inflationRate < 5) tokenomicsScore += 7;
    else if (inflationRate < 20) tokenomicsScore += 4;
    else tokenomicsScore += 1;
    
    // Market cap vs FDV (5 points)
    if (fullyDilutedValuation && coinData.market_cap) {
      const mcFdvRatio = coinData.market_cap / fullyDilutedValuation;
      if (mcFdvRatio > 0.95) tokenomicsScore += 5;
      else if (mcFdvRatio > 0.8) tokenomicsScore += 3;
      else if (mcFdvRatio > 0.6) tokenomicsScore += 1;
    }
    
    // 2. Activity Score (25 points)
    let activityScore = 0;
    
    // Developer activity (15 points)
    if (devActivity) {
      activityScore += Math.min(15, devActivity.score * 0.15);
    }
    
    // Community engagement (10 points)
    const twitterFollowers = detailData.community_data?.twitter_followers || 0;
    const redditSubscribers = detailData.community_data?.reddit_subscribers || 0;
    const totalCommunity = twitterFollowers + redditSubscribers;
    
    if (totalCommunity > 1000000) activityScore += 10;
    else if (totalCommunity > 500000) activityScore += 7;
    else if (totalCommunity > 100000) activityScore += 4;
    else if (totalCommunity > 10000) activityScore += 2;
    
    // 3. Liquidity Score (25 points)
    let liquidityScore = 0;
    
    // TVL score (15 points)
    if (tvl) {
      if (tvl > 1000000000) liquidityScore += 15;  // >$1B TVL
      else if (tvl > 500000000) liquidityScore += 12;
      else if (tvl > 100000000) liquidityScore += 8;
      else if (tvl > 50000000) liquidityScore += 4;
    }
    
    // Market cap (10 points)
    if (coinData.market_cap > 10000000000) liquidityScore += 10;  // >$10B
    else if (coinData.market_cap > 1000000000) liquidityScore += 7; // >$1B
    else if (coinData.market_cap > 100000000) liquidityScore += 4;  // >$100M
    else if (coinData.market_cap > 10000000) liquidityScore += 2;
    
    // 4. Community Score (20 points)
    let communityScore = 0;
    
    // Reddit activity (10 points)
    const redditActivity = detailData.community_data?.reddit_average_comments_48h || 0;
    if (redditActivity > 50) communityScore += 10;
    else if (redditActivity > 20) communityScore += 7;
    else if (redditActivity > 5) communityScore += 4;
    
    // Social sentiment (10 points)
    const sentimentVotesUp = detailData.sentiment_votes_up_percentage || 50;
    if (sentimentVotesUp > 75) communityScore += 10;
    else if (sentimentVotesUp > 60) communityScore += 7;
    else if (sentimentVotesUp > 50) communityScore += 4;
    else communityScore += 2;
    
    // Calculate total fundamental score
    const fundamentalScore = tokenomicsScore + activityScore + liquidityScore + communityScore;
    
    const result: FundamentalData = {
      symbol,
      name: baseName,
      marketCap: coinData.market_cap,
      fullyDilutedValuation,
      circulatingSupply,
      totalSupply,
      maxSupply,
      dilutionRisk,
      inflationRate: Math.round(inflationRate * 10) / 10,
      tvl,
      tvlRank,
      developerActivity: devActivity,
      onChainMetrics,
      fundamentalScore: Math.round(fundamentalScore),
      breakdown: {
        tokenomicsScore: Math.round(tokenomicsScore),
        activityScore: Math.round(activityScore),
        liquidityScore: Math.round(liquidityScore),
        communityScore: Math.round(communityScore)
      }
    };
    
    console.log(`✅ Fundamental score: ${result.fundamentalScore}/100`);
    
    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Fundamental analysis error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
