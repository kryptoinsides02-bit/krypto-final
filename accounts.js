const ACCOUNTS = [

  // 🐋 WHALE ALERTS & ON-CHAIN
  { handle: 'whale_alert',      name: 'Whale Alert',        category: 'Whale Alerts',          emoji: '🐋', priority: true },
  { handle: 'ArkhamIntel',      name: 'Arkham',             category: 'Whale Alerts',          emoji: '🐋', priority: true },
  { handle: 'lookonchain',      name: 'Lookonchain',        category: 'Whale Alerts',          emoji: '🐋', priority: true },
  { handle: 'PeckShieldAlert',  name: 'PeckShield Alert',   category: 'Whale Alerts',          emoji: '🐋', priority: true },
  { handle: 'EmberCN',          name: 'Ember CN',           category: 'Whale Alerts',          emoji: '🐋' },
  { handle: 'SpotonChain',      name: 'Spot On Chain',      category: 'Whale Alerts',          emoji: '🐋' },
  { handle: 'WhaleInsider',     name: 'Whale Insider',      category: 'Whale Alerts',          emoji: '🐋' },
  { handle: 'onchainlens',      name: 'OnChain Lens',       category: 'Whale Alerts',          emoji: '🐋' },

  // 📰 NEWS MEDIA
  { handle: 'WatcherGuru',      name: 'Watcher Guru',       category: 'Crypto News',           emoji: '📰', priority: true },
  { handle: 'BitcoinArchive',   name: 'Bitcoin Archive',    category: 'Crypto News',           emoji: '📰', priority: true },
  { handle: 'CoinDesk',         name: 'CoinDesk',           category: 'Crypto News',           emoji: '📰', priority: true },
  { handle: 'Cointelegraph',    name: 'Cointelegraph',      category: 'Crypto News',           emoji: '📰', priority: true },
  { handle: 'TheBlock_',        name: 'The Block',          category: 'Crypto News',           emoji: '📰', priority: true },
  { handle: 'DecryptMedia',     name: 'Decrypt',            category: 'Crypto News',           emoji: '📰', priority: true },
  { handle: 'BitcoinMagazine',  name: 'Bitcoin Magazine',   category: 'Crypto News',           emoji: '📰' },
  { handle: 'Blockworks_',      name: 'Blockworks',         category: 'Crypto News',           emoji: '📰' },
  { handle: 'CryptoSlate',      name: 'CryptoSlate',        category: 'Crypto News',           emoji: '📰' },
  { handle: 'Bitcoinist',       name: 'Bitcoinist',         category: 'Crypto News',           emoji: '📰' },
  { handle: 'CryptoBriefing',   name: 'Crypto Briefing',    category: 'Crypto News',           emoji: '📰' },
  { handle: 'DLNewsInfo',       name: 'DL News',            category: 'Crypto News',           emoji: '📰' },
  { handle: 'TheDefiant_',      name: 'The Defiant',        category: 'Crypto News',           emoji: '📰' },
  { handle: 'beincrypto',       name: 'BeInCrypto',         category: 'Crypto News',           emoji: '📰' },
  { handle: 'Bankless',         name: 'Bankless',           category: 'Crypto News',           emoji: '📰' },
  { handle: 'CoinGape',         name: 'CoinGape',           category: 'Crypto News',           emoji: '📰' },
  { handle: 'NewsbtcCom',       name: 'NewsBTC',            category: 'Crypto News',           emoji: '📰' },
  { handle: 'AMBCrypto',        name: 'AMBCrypto',          category: 'Crypto News',           emoji: '📰' },
  { handle: 'utoday_en',        name: 'U.Today',            category: 'Crypto News',           emoji: '📰' },
  { handle: 'BTCTN',            name: 'Bitcoin.com News',   category: 'Crypto News',           emoji: '📰' },
  { handle: 'ProtosCrypto',     name: 'Protos',             category: 'Crypto News',           emoji: '📰' },
  { handle: 'Cryptonewscom',    name: 'CryptoNews',         category: 'Crypto News',           emoji: '📰' },

  // 📊 TECHNICAL ANALYSTS
  { handle: 'CryptoKaleo',      name: 'KALEO',              category: 'Technical Analysis',    emoji: '📊' },
  { handle: 'rektcapital',      name: 'Rekt Capital',       category: 'Technical Analysis',    emoji: '📊' },
  { handle: 'willywoo',         name: 'Willy Woo',          category: 'Technical Analysis',    emoji: '📊' },
  { handle: 'scottmelker',      name: 'Scott Melker',       category: 'Technical Analysis',    emoji: '📊' },
  { handle: 'CryptoTony100',    name: 'Tony The Bull',      category: 'Technical Analysis',    emoji: '📊' },
  { handle: 'MichaelVanDePop',  name: 'Michael van de Poppe', category: 'Technical Analysis', emoji: '📊' },
  { handle: 'CryptoRover',      name: 'Crypto Rover',       category: 'Technical Analysis',    emoji: '📊' },
  { handle: 'KoroushAK',        name: 'Koroush AK',         category: 'Technical Analysis',    emoji: '📊' },
  { handle: 'TedPillows',       name: 'Ted',                category: 'Technical Analysis',    emoji: '📊' },
  { handle: 'AltcoinPsycho',    name: 'Altcoin Psycho',     category: 'Technical Analysis',    emoji: '📊' },
  { handle: 'CryptoCon_',       name: 'CryptoCon',          category: 'Technical Analysis',    emoji: '📊' },
  { handle: 'AshCryptoReal',    name: 'Ash Crypto',         category: 'Technical Analysis',    emoji: '📊' },
  { handle: 'pentosh1',         name: 'Pentoshi',           category: 'Technical Analysis',    emoji: '📊' },

  // 👨‍💻 FOUNDERS & DEVS
  { handle: 'VitalikButerin',   name: 'Vitalik Buterin',    category: 'Founders & Devs',       emoji: '👨‍💻', priority: true },
  { handle: 'aeyakovenko',      name: 'Toly (Solana)',      category: 'Founders & Devs',       emoji: '👨‍💻', priority: true },
  { handle: 'saylor',           name: 'Michael Saylor',     category: 'Founders & Devs',       emoji: '👨‍💻', priority: true },
  { handle: 'cz_binance',       name: 'CZ Binance',         category: 'Founders & Devs',       emoji: '👨‍💻', priority: true },
  { handle: 'brian_armstrong',  name: 'Brian Armstrong',    category: 'Founders & Devs',       emoji: '👨‍💻' },
  { handle: 'jack',             name: 'Jack Dorsey',        category: 'Founders & Devs',       emoji: '👨‍💻' },
  { handle: 'hosseeb',          name: 'Haseeb Qureshi',     category: 'Founders & Devs',       emoji: '👨‍💻' },
  { handle: 'egsol',            name: 'Raj Gokal (SOL)',    category: 'Founders & Devs',       emoji: '👨‍💻' },
  { handle: 'stani',            name: 'Stani (Aave)',       category: 'Founders & Devs',       emoji: '👨‍💻' },
  { handle: 'hayden_adams',     name: 'Hayden (Uniswap)',   category: 'Founders & Devs',       emoji: '👨‍💻' },
  { handle: 'jessepollak',      name: 'Jesse Pollak (Base)', category: 'Founders & Devs',     emoji: '👨‍💻' },
  { handle: 'iohk_charles',     name: 'Charles Hoskinson',  category: 'Founders & Devs',       emoji: '👨‍💻' },
  { handle: 'novogratz',        name: 'Mike Novogratz',     category: 'Founders & Devs',       emoji: '👨‍💻' },

  // 🏦 EXCHANGES
  { handle: 'binance',          name: 'Binance',            category: 'Exchanges',             emoji: '🏦', priority: true },
  { handle: 'coinbase',         name: 'Coinbase',           category: 'Exchanges',             emoji: '🏦', priority: true },
  { handle: 'krakenfx',         name: 'Kraken',             category: 'Exchanges',             emoji: '🏦' },
  { handle: 'okx',              name: 'OKX',                category: 'Exchanges',             emoji: '🏦' },
  { handle: 'Bybit_Official',   name: 'Bybit',              category: 'Exchanges',             emoji: '🏦' },
  { handle: 'Bitget_Official',  name: 'Bitget',             category: 'Exchanges',             emoji: '🏦' },
  { handle: 'gate_io',          name: 'Gate.io',            category: 'Exchanges',             emoji: '🏦' },
  { handle: 'HTX_Global',       name: 'HTX (Huobi)',        category: 'Exchanges',             emoji: '🏦' },
  { handle: 'mexc_global',      name: 'MEXC',               category: 'Exchanges',             emoji: '🏦' },
  { handle: 'CoinbaseAssets',   name: 'Coinbase Assets',    category: 'Exchanges',             emoji: '🏦' },

  // ⚖️ REGULATORY
  { handle: 'SECGov',           name: 'SEC',                category: 'Regulatory',            emoji: '⚖️', priority: true },
  { handle: 'CFTC',             name: 'CFTC',               category: 'Regulatory',            emoji: '⚖️', priority: true },
  { handle: 'EleanorTerrett',   name: 'Eleanor Terrett',    category: 'Regulatory',            emoji: '⚖️' },
  { handle: 'jchervinsky',      name: 'Jake Chervinsky',    category: 'Regulatory',            emoji: '⚖️' },
  { handle: 'NayibBukele',      name: 'Nayib Bukele',       category: 'Regulatory',            emoji: '⚖️' },
  { handle: 'CaitlinLong_',     name: 'Caitlin Long',       category: 'Regulatory',            emoji: '⚖️' },
  { handle: 'APompliano',       name: 'Pompliano',          category: 'Regulatory',            emoji: '⚖️' },
  { handle: 'RaoulGMI',         name: 'Raoul Pal',          category: 'Regulatory',            emoji: '⚖️' },

  // 🔐 SECURITY & HACKS
  { handle: 'ZachXBT',          name: 'ZachXBT',            category: 'Security',              emoji: '🔐', priority: true },
  { handle: 'SlowMist_Team',    name: 'SlowMist',           category: 'Security',              emoji: '🔐', priority: true },
  { handle: 'CertiKAlert',      name: 'CertiK Alert',       category: 'Security',              emoji: '🔐' },
  { handle: 'BlockSecTeam',     name: 'BlockSec',           category: 'Security',              emoji: '🔐' },
  { handle: 'BeosinAlert',      name: 'Beosin Alert',       category: 'Security',              emoji: '🔐' },
  { handle: 'Hacken_io',        name: 'Hacken',             category: 'Security',              emoji: '🔐' },

];

const EMERGENCY_KEYWORDS = [
  'BREAKING', 'JUST IN', 'URGENT', 'ALERT', 'HACK', 'EXPLOIT', 'FLASH CRASH',
  'EMERGENCY', 'CRITICAL', 'LIQUIDAT', 'CRASH', 'COLLAPSE', 'DELIST',
  'SCAM', 'RUG', 'STOLEN', 'COMPROMISED', 'SUSPENDED', 'HALTED',
  'ETF APPROVED', 'ETF REJECTED', 'BAN', 'SEIZED', 'ARRESTED',
  'INVESTIGATION', 'LAWSUIT', 'FINED', 'SEC ACTION', 'SANCTIONS',
  'BRIDGE HACK', 'EXCHANGE DOWN', 'WITHDRAWAL SUSPENDED', 'FLASH LOAN'
];

const LISTING_KEYWORDS = [
  'listing', 'listed', 'will list', 'now live', 'trading now',
  'just listed', 'new listing', 'token launch', 'trading pair'
];

module.exports = { ACCOUNTS, EMERGENCY_KEYWORDS, LISTING_KEYWORDS };
