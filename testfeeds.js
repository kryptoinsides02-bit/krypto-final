const RSSParser = require('rss-parser');
const parser = new RSSParser({ timeout: 8000 });
const feeds = [
  ['CoinDesk','https://www.coindesk.com/arc/outboundfeeds/rss/'],
  ['Cointelegraph','https://cointelegraph.com/rss'],
  ['The Block','https://www.theblock.co/rss.xml'],
  ['Decrypt','https://decrypt.co/feed'],
  ['Blockworks','https://blockworks.co/feed'],
  ['Bitcoin Magazine','https://bitcoinmagazine.com/.rss/full/'],
  ['CryptoSlate','https://cryptoslate.com/feed/'],
  ['BeInCrypto','https://beincrypto.com/feed/'],
  ['Bankless','https://www.bankless.com/feed'],
  ['The Defiant','https://thedefiant.io/feed'],
  ['CoinGape','https://coingape.com/feed/'],
  ['NewsBTC','https://www.newsbtc.com/feed/'],
  ['AMBCrypto','https://ambcrypto.com/feed/'],
  ['U.Today','https://u.today/rss'],
  ['Bitcoin.com','https://news.bitcoin.com/feed/'],
  ['DL News','https://www.dlnews.com/arc/outboundfeeds/rss/'],
  ['Protos','https://protos.com/feed/'],
  ['CryptoNews','https://cryptonews.com/news/feed/'],
  ['Crypto Briefing','https://cryptobriefing.com/feed/'],
  ['Unchained','https://unchainedcrypto.com/feed/'],
  ['Bitcoinist','https://bitcoinist.com/feed/'],
  ['CoinTribune','https://www.cointribune.com/en/feed/'],
  ['Messari','https://messari.io/rss/news'],
  ['Forbes Crypto','https://www.forbes.com/crypto-blockchain/feed/'],
  ['NullTX','https://nulltx.com/feed/'],
];
(async()=>{
  for(const [n,u] of feeds){
    try{
      const f=await parser.parseURL(u);
      const age=f.items[0]?.pubDate?Math.floor((Date.now()-new Date(f.items[0].pubDate))/60000)+'m':'?';
      console.log('OK   | '+n.padEnd(20)+' | latest: '+age);
    }catch(e){
      console.log('FAIL | '+n.padEnd(20)+' | '+e.message.slice(0,60));
    }
  }
})();
