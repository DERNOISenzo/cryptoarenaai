import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

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

// Fetch RSS feed and parse
async function fetchRSSFeed(url: string, sourceName: string): Promise<NewsArticle[]> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) return [];
    
    const xmlText = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    
    if (!doc) return [];
    
    const items = doc.querySelectorAll('item');
    const articles: NewsArticle[] = [];
    
    items.forEach((item, index) => {
      if (index >= 5) return; // Limit to 5 per source
      
      const titleEl = item.querySelector('title');
      const linkEl = item.querySelector('link');
      const pubDateEl = item.querySelector('pubDate');
      const descEl = item.querySelector('description');
      
      if (titleEl && linkEl) {
        const title = titleEl.textContent || '';
        const description = descEl?.textContent || '';
        const fullText = title + ' ' + description;
        
        articles.push({
          title,
          url: linkEl.textContent || '',
          source: sourceName,
          published: pubDateEl?.textContent || new Date().toISOString(),
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

// Scrape web page for articles
async function scrapeWebPage(url: string, sourceName: string, selector: string): Promise<NewsArticle[]> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) return [];
    
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    if (!doc) return [];
    
    const articles: NewsArticle[] = [];
    const elements = doc.querySelectorAll(selector);
    
    elements.forEach((el, index) => {
      if (index >= 5) return;
      
      const titleEl = el.querySelector('h2, h3, .title');
      const linkEl = el.querySelector('a');
      
      if (titleEl && linkEl) {
        const title = titleEl.textContent || '';
        const href = linkEl.getAttribute('href') || '';
        const fullUrl = href.startsWith('http') ? href : new URL(href, url).href;
        
        articles.push({
          title,
          url: fullUrl,
          source: sourceName,
          published: new Date().toISOString(),
          sentiment: analyzeSentiment(title),
          keywords: extractKeywords(title)
        });
      }
    });
    
    return articles;
  } catch (error) {
    console.error(`Error scraping ${sourceName}:`, error);
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

    // 8 sources d'actualités crypto
    const newsSources = [
      // RSS Feeds
      { 
        type: 'rss',
        url: 'https://cointelegraph.com/rss',
        name: 'Cointelegraph'
      },
      {
        type: 'rss', 
        url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
        name: 'CoinDesk'
      },
      {
        type: 'rss',
        url: 'https://cryptoast.fr/feed/',
        name: 'Cryptoast'
      },
      {
        type: 'rss',
        url: 'https://journalducoin.com/feed/',
        name: 'Journal du Coin'
      },
      // Web Scraping fallbacks
      {
        type: 'web',
        url: 'https://coinmarketcap.com/headlines/news/',
        name: 'CoinMarketCap',
        selector: '.sc-aef7b723-0'
      },
      {
        type: 'web',
        url: 'https://www.binance.com/en/news/top',
        name: 'Binance News',
        selector: '.css-1ej4hfo'
      },
      {
        type: 'web',
        url: 'https://www.investing.com/news/cryptocurrency-news',
        name: 'Investing.com',
        selector: '.article-list article'
      },
      {
        type: 'web',
        url: 'https://www.tradingview.com/news/',
        name: 'TradingView',
        selector: '.news-item'
      }
    ];

    // Fetch from all sources in parallel
    const newsPromises = newsSources.map(source => {
      if (source.type === 'rss') {
        return fetchRSSFeed(source.url, source.name);
      } else {
        return scrapeWebPage(source.url, source.name, source.selector || 'article');
      }
    });

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