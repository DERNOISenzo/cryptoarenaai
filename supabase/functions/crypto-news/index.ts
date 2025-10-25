import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsArticle {
  title: string;
  url: string;
  source: string;
  published: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  keywords: string[];
}

// Simple sentiment analysis based on keywords
function analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lowerText = text.toLowerCase();
  
  const positiveWords = ['hausse', 'monte', 'gain', 'bull', 'rallye', 'surge', 'rise', 'up', 'pump', 'breakthrough', 'adoption', 'innovation'];
  const negativeWords = ['baisse', 'chute', 'perte', 'bear', 'crash', 'drop', 'down', 'dump', 'scam', 'hack', 'regulation'];
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  positiveWords.forEach(word => {
    if (lowerText.includes(word)) positiveCount++;
  });
  
  negativeWords.forEach(word => {
    if (lowerText.includes(word)) negativeCount++;
  });
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

// Extract keywords from text
function extractKeywords(text: string): string[] {
  const cryptoKeywords = ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'blockchain', 'defi', 'nft', 'altcoin', 'trading'];
  const keywords: string[] = [];
  const lowerText = text.toLowerCase();
  
  cryptoKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) {
      keywords.push(keyword);
    }
  });
  
  return keywords;
}

// Fetch RSS feed
async function fetchRSSFeed(url: string, sourceName: string): Promise<NewsArticle[]> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) return [];
    
    const xmlText = await response.text();
    
    // Simple XML parsing without external libraries
    const articles: NewsArticle[] = [];
    const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];
    
    itemMatches.slice(0, 5).forEach(itemXml => {
      const titleMatch = itemXml.match(/<title>(<!\[CDATA\[)?(.*?)(\]\]>)?<\/title>/);
      const linkMatch = itemXml.match(/<link>(<!\[CDATA\[)?(.*?)(\]\]>)?<\/link>/);
      const descMatch = itemXml.match(/<description>(<!\[CDATA\[)?(.*?)(\]\]>)?<\/description>/);
      const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
      
      if (titleMatch && linkMatch) {
        const title = titleMatch[2].trim();
        const description = descMatch ? descMatch[2].trim() : '';
        const fullText = title + ' ' + description;
        
        articles.push({
          title: title.replace(/<[^>]+>/g, ''), // Strip HTML tags
          url: linkMatch[2].trim(),
          source: sourceName,
          published: pubDateMatch ? pubDateMatch[1] : new Date().toISOString(),
          sentiment: analyzeSentiment(fullText),
          keywords: extractKeywords(fullText)
        });
      }
    });
    
    return articles;
  } catch (error) {
    console.error(`Error fetching ${sourceName}:`, error);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, baseAsset } = await req.json();
    console.log('Fetching news for:', symbol, baseAsset);

    // 8 sources d'actualités crypto (RSS only for reliability)
    const newsSources = [
      { url: 'https://cointelegraph.com/rss', name: 'Cointelegraph' },
      { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', name: 'CoinDesk' },
      { url: 'https://cryptoast.fr/feed/', name: 'Cryptoast' },
      { url: 'https://journalducoin.com/feed/', name: 'Journal du Coin' },
      { url: 'https://cryptonews.com/news/feed/', name: 'CryptoNews' },
      { url: 'https://bitcoinmagazine.com/feed', name: 'Bitcoin Magazine' },
      { url: 'https://decrypt.co/feed', name: 'Decrypt' },
      { url: 'https://www.theblockcrypto.com/rss.xml', name: 'The Block' }
    ];

    // Fetch from all sources in parallel
    const newsPromises = newsSources.map(source => 
      fetchRSSFeed(source.url, source.name)
    );

    const allNewsArrays = await Promise.all(newsPromises);
    const allNews = allNewsArrays.flat();

    // Filter by symbol/asset if provided
    let filteredNews = allNews;
    if (baseAsset) {
      const searchTerms = [baseAsset.toLowerCase(), symbol.toLowerCase()];
      filteredNews = allNews.filter(article => {
        const searchText = (article.title + ' ' + article.keywords.join(' ')).toLowerCase();
        return searchTerms.some(term => searchText.includes(term));
      });
    }

    // Sort by sentiment and date
    filteredNews.sort((a, b) => {
      const sentimentScore = { positive: 3, neutral: 2, negative: 1 };
      const scoreA = sentimentScore[a.sentiment];
      const scoreB = sentimentScore[b.sentiment];
      
      if (scoreA !== scoreB) return scoreB - scoreA;
      return new Date(b.published).getTime() - new Date(a.published).getTime();
    });

    // Take top 15 articles
    const topNews = filteredNews.slice(0, 15);

    // Calculate overall sentiment
    const sentimentCounts = topNews.reduce((acc, article) => {
      acc[article.sentiment]++;
      return acc;
    }, { positive: 0, neutral: 0, negative: 0 });

    const overallSentiment = sentimentCounts.positive > sentimentCounts.negative 
      ? 'positive' 
      : sentimentCounts.negative > sentimentCounts.positive 
        ? 'negative' 
        : 'neutral';

    return new Response(JSON.stringify({ 
      news: topNews,
      totalArticles: allNews.length,
      filteredArticles: filteredNews.length,
      sentiment: {
        overall: overallSentiment,
        breakdown: sentimentCounts
      },
      sources: newsSources.map(s => s.name)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in crypto-news:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      news: [],
      totalArticles: 0,
      filteredArticles: 0,
      sentiment: { overall: 'neutral', breakdown: { positive: 0, neutral: 0, negative: 0 } }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});