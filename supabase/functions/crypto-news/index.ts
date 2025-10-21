import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, baseAsset } = await req.json();
    console.log('Fetching news for:', symbol, baseAsset);

    // Use CryptoPanic API (free tier)
    // For better results, users can add their own CRYPTOPANIC_API_KEY
    const apiKey = Deno.env.get('CRYPTOPANIC_API_KEY') || 'free';
    
    const currencies = baseAsset ? baseAsset.toLowerCase() : '';
    const newsRes = await fetch(
      `https://cryptopanic.com/api/v1/posts/?auth_token=${apiKey}&currencies=${currencies}&kind=news&filter=rising`
    );
    
    const newsData = await newsRes.json();
    
    let news: any[] = [];
    if (newsData.results && Array.isArray(newsData.results)) {
      news = newsData.results.slice(0, 10).map((item: any) => ({
        title: item.title,
        url: item.url,
        source: item.source?.title || 'Unknown',
        published: item.published_at,
        sentiment: item.votes?.positive > item.votes?.negative ? 'positive' : 
                   item.votes?.negative > item.votes?.positive ? 'negative' : 'neutral'
      }));
    }

    // Fallback: fetch general crypto news if no specific news found
    if (news.length === 0) {
      const generalNewsRes = await fetch(
        `https://cryptopanic.com/api/v1/posts/?auth_token=${apiKey}&kind=news&filter=hot`
      );
      const generalNews = await generalNewsRes.json();
      
      if (generalNews.results && Array.isArray(generalNews.results)) {
        news = generalNews.results.slice(0, 5).map((item: any) => ({
          title: item.title,
          url: item.url,
          source: item.source?.title || 'Unknown',
          published: item.published_at,
          sentiment: item.votes?.positive > item.votes?.negative ? 'positive' : 
                     item.votes?.negative > item.votes?.positive ? 'negative' : 'neutral'
        }));
      }
    }

    // Try to fetch tweets using Twitter API v2 (requires API key)
    let tweets: any[] = [];
    const twitterBearerToken = Deno.env.get('TWITTER_BEARER_TOKEN');
    
    if (twitterBearerToken && baseAsset) {
      try {
        const query = `$${baseAsset} OR ${baseAsset}USD lang:en -is:retweet`;
        const twitterRes = await fetch(
          `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=10&tweet.fields=created_at,public_metrics`,
          {
            headers: {
              'Authorization': `Bearer ${twitterBearerToken}`
            }
          }
        );
        
        if (twitterRes.ok) {
          const twitterData = await twitterRes.json();
          if (twitterData.data) {
            tweets = twitterData.data.map((tweet: any) => ({
              text: tweet.text,
              created: tweet.created_at,
              likes: tweet.public_metrics?.like_count || 0,
              retweets: tweet.public_metrics?.retweet_count || 0
            }));
          }
        }
      } catch (error) {
        console.error('Twitter fetch error:', error);
      }
    }

    return new Response(JSON.stringify({ news, tweets }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in crypto-news:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      news: [],
      tweets: []
    }), {
      status: 200, // Return 200 with empty arrays instead of error
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
