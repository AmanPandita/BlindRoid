import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const subreddit = url.searchParams.get('subreddit');
  const q = url.searchParams.get('q');
  const limit = url.searchParams.get('limit') ?? '100';
  const t = url.searchParams.get('t') ?? 'month';

  if (!subreddit || !q) {
    return new Response(JSON.stringify({ error: 'Missing subreddit or q params' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const redditUrl = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(q)}&restrict_sr=1&sort=new&limit=${limit}&t=${t}`;

  const response = await fetch(redditUrl, {
    headers: { 'User-Agent': 'bWARNed/1.0' },
  });

  const data = await response.json();

  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
