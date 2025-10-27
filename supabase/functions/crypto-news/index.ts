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
  sentiment: 'très positif' | 'positif' | 'neutre' | 'négatif' | 'très négatif';
  sentimentScore: number; // -2 à +2
  keywords: string[];
  criticalKeywords: string[];
}

// Advanced sentiment analysis with critical keyword detection
function analyzeSentiment(text: string): { sentiment: NewsArticle['sentiment']; score: number; criticalKeywords: string[] } {
  const lowerText = text.toLowerCase();
  
  // Critical keywords (higher weight)
  const criticalPositive = ['listing', 'partnership', 'partenariat', 'upgrade', 'mainnet', 'adoption massive', 'institutional', 'breakthrough'];
  const criticalNegative = ['hack', 'scam', 'rug pull', 'exploit', 'regulation', 'ban', 'lawsuit', 'fraud', 'ponzi'];
  
  // Standard keywords
  const positiveWords = ['hausse', 'monte', 'gain', 'bull', 'rallye', 'surge', 'rise', 'up', 'pump', 'innovation', 'growth', 'success', 'profit'];
  const negativeWords = ['baisse', 'chute', 'perte', 'bear', 'crash', 'drop', 'down', 'dump', 'decline', 'loss', 'risk', 'warning'];
  
  let score = 0;
  const foundCriticalKeywords: string[] = [];
  
  // Check critical keywords (weight: 2)
  criticalPositive.forEach(word => {
    if (lowerText.includes(word)) {
      score += 2;
      foundCriticalKeywords.push(word);
    }
  });
  
  criticalNegative.forEach(word => {
    if (lowerText.includes(word)) {
      score -= 2;
      foundCriticalKeywords.push(word);
    }
  });
  
  // Check standard keywords (weight: 1)
  positiveWords.forEach(word => {
    if (lowerText.includes(word)) score += 1;
  });
  
  negativeWords.forEach(word => {
    if (lowerText.includes(word)) score -= 1;
  });
  
  // Determine sentiment category
  let sentiment: NewsArticle['sentiment'];
  if (score >= 3) sentiment = 'très positif';
  else if (score >= 1) sentiment = 'positif';
  else if (score <= -3) sentiment = 'très négatif';
  else if (score <= -1) sentiment = 'négatif';
  else sentiment = 'neutre';
  
  // Normalize score to -2 to +2 range
  const normalizedScore = Math.max(-2, Math.min(2, score / 3));
  
  return { sentiment, score: normalizedScore, criticalKeywords: foundCriticalKeywords };
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

// Fetch RSS feed with HTML fallback
async function fetchRSSFeed(url: string, sourceName: string): Promise<NewsArticle[]> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      console.log(`RSS failed for ${sourceName}, trying HTML fallback...`);
      return await fetchHTMLFallback(url, sourceName);
    }
    
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
        
        const { sentiment, score, criticalKeywords } = analyzeSentiment(fullText);
        
        articles.push({
          title: title.replace(/<[^>]+>/g, ''), // Strip HTML tags
          url: linkMatch[2].trim(),
          source: sourceName,
          published: pubDateMatch ? pubDateMatch[1] : new Date().toISOString(),
          sentiment,
          sentimentScore: score,
          keywords: extractKeywords(fullText),
          criticalKeywords
        });
      }
    });
    
    return articles;
  } catch (error) {
    console.error(`Error fetching ${sourceName}:`, error);
    return await fetchHTMLFallback(url, sourceName);
  }
}

// HTML fallback parser for when RSS fails
async function fetchHTMLFallback(url: string, sourceName: string): Promise<NewsArticle[]> {
  try {
    const baseUrl = new URL(url).origin;
    const response = await fetch(baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) return [];
    
    const htmlText = await response.text();
    const articles: NewsArticle[] = [];
    
    // Extract article titles using common HTML patterns
    const titlePatterns = [
      /<h[123][^>]*class="[^"]*title[^"]*"[^>]*>(.*?)<\/h[123]>/gi,
      /<a[^>]*class="[^"]*headline[^"]*"[^>]*>(.*?)<\/a>/gi,
      /<h[123][^>]*>(.*?)<\/h[123]>/gi
    ];
    
    const foundTitles = new Set<string>();
    
    titlePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(htmlText)) !== null && foundTitles.size < 5) {
        const title = match[1].replace(/<[^>]+>/g, '').trim();
        if (title.length > 20 && title.length < 200) {
          foundTitles.add(title);
        }
      }
    });
    
    foundTitles.forEach(title => {
      const { sentiment, score, criticalKeywords } = analyzeSentiment(title);
      articles.push({
        title,
        url: baseUrl,
        source: `${sourceName} (HTML)`,
        published: new Date().toISOString(),
        sentiment,
        sentimentScore: score,
        keywords: extractKeywords(title),
        criticalKeywords
      });
    });
    
    return articles;
  } catch (error) {
    console.error(`HTML fallback failed for ${sourceName}:`, error);
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

    // 8 sources d'actualités crypto conformes - URLs vérifiées
    const newsSources = [
      { url: 'https://cointelegraph.com/rss', name: 'CoinTelegraph' },
      { url: 'https://coindesk.com/arc/outboundfeeds/rss/', name: 'CoinDesk' },
      { url: 'https://cryptoast.fr/feed/', name: 'Cryptoast' },
      { url: 'https://www.investing.com/rss/news_285.rss', name: 'Investing.com Crypto' },
      { url: 'https://bitcoinmagazine.com/.rss/full/', name: 'Bitcoin Magazine' },
      { url: 'https://decrypt.co/feed', name: 'Decrypt' },
      { url: 'https://www.theblock.co/rss.xml', name: 'The Block' },
      { url: 'https://cryptonews.com/news/feed/', name: 'CryptoNews' }
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
      // Sort by sentiment score first (higher is better)
      if (a.sentimentScore !== b.sentimentScore) {
        return b.sentimentScore - a.sentimentScore;
      }
      // Then by date (newer first)
      return new Date(b.published).getTime() - new Date(a.published).getTime();
    });

    // Take top 15 articles
    const topNews = filteredNews.slice(0, 15);

    // Calculate overall sentiment with weighted score
    const avgScore = topNews.length > 0 
      ? topNews.reduce((sum, article) => sum + article.sentimentScore, 0) / topNews.length
      : 0;
    
    let overallSentiment: NewsArticle['sentiment'];
    if (avgScore >= 1) overallSentiment = 'très positif';
    else if (avgScore >= 0.3) overallSentiment = 'positif';
    else if (avgScore <= -1) overallSentiment = 'très négatif';
    else if (avgScore <= -0.3) overallSentiment = 'négatif';
    else overallSentiment = 'neutre';

    // Collect all critical keywords
    const allCriticalKeywords = topNews.flatMap(article => article.criticalKeywords);

    return new Response(JSON.stringify({ 
      news: topNews,
      totalArticles: allNews.length,
      filteredArticles: filteredNews.length,
      sentiment: {
        overall: overallSentiment,
        score: avgScore,
        criticalKeywords: allCriticalKeywords
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
      sentiment: { overall: 'neutre', score: 0, criticalKeywords: [] }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});