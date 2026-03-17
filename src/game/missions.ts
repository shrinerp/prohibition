// ── Mission Cards — Prohibition-era contract objectives ────────────────────────

export type MissionTier = 'easy' | 'medium' | 'hard' | 'legendary'

export type MissionObjectiveType =
  | 'cash_gte' | 'cities_owned_gte' | 'vehicles_owned_gte' | 'distillery_tier_gte'
  | 'total_cargo_units_gte' | 'cargo_units_of_type_gte' | 'heat_at_most' | 'heat_at_least'
  | 'total_sold_units' | 'sold_units_of_type' | 'total_cash_earned'
  | 'officials_bribed' | 'cities_visited' | 'turns_without_arrest' | 'sabotages_completed'

export interface MissionCard {
  id: number
  tier: MissionTier
  objectiveType: MissionObjectiveType
  params: Record<string, number | string>
  reward: number
  title: string
  flavor: string
  historyNote: string
  wikiUrl: string
}

export interface MissionSnapshot {
  cash: number
  citiesOwned: number
  vehiclesOwned: number
  maxDistilleryTier: number
  totalCargoUnits: number
  cargoByType: Record<string, number>
  heat: number
  totalCashEarned: number
  consecutiveCleanSeasons: number
}

export type CumulativeEvent =
  | { type: 'sold_units'; quantity: number; alcoholType: string; revenue: number }
  | { type: 'official_bribed' }
  | { type: 'city_visited'; cityId: number }
  | { type: 'sabotage_completed' }

// ── Static card definitions ────────────────────────────────────────────────────

export const MISSION_CARDS: MissionCard[] = [
  // ── Easy (1–13) ────────────────────────────────────────────────────────────
  {
    id: 1, tier: 'easy', objectiveType: 'cash_gte', params: { target: 500 }, reward: 500,
    title: 'The Volstead Wager',
    flavor: '"The Act passed. The money followed."',
    historyNote: 'The Volstead Act (1919) defined "intoxicating liquors" and set enforcement rules for the 18th Amendment — inadvertently creating a vast black market.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Volstead_Act',
  },
  {
    id: 2, tier: 'easy', objectiveType: 'total_sold_units', params: { target: 10 }, reward: 600,
    title: 'The Real McCoy',
    flavor: '"No watered-down rot. Quality moves itself."',
    historyNote: 'Bill McCoy smuggled uncut Scotch and rum from the Bahamas, earning such a reputation for unadulterated product that his name became a byword for authenticity.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Bill_McCoy_(bootlegger)',
  },
  {
    id: 3, tier: 'easy', objectiveType: 'cities_visited', params: { target: 3 }, reward: 700,
    title: 'Local Color',
    flavor: '"Three towns. Three thirsty sheriffs. One night."',
    historyNote: 'Roy Olmstead ran liquor across multiple Washington State towns before becoming Seattle\'s most prominent bootlegger — the "King of Bootleggers."',
    wikiUrl: 'https://en.wikipedia.org/wiki/Roy_Olmstead',
  },
  {
    id: 4, tier: 'easy', objectiveType: 'heat_at_most', params: { target: 20 }, reward: 600,
    title: 'Laid Low',
    flavor: '"Stay under the radar. Stay out of cuffs."',
    historyNote: 'Prohibition agents like Izzy Einstein used elaborate disguises — postman, fisherman, football player — to catch bootleggers who had grown complacent.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Izzy_Einstein',
  },
  {
    id: 5, tier: 'easy', objectiveType: 'cargo_units_of_type_gte', params: { target: 5, alcoholType: 'beer' }, reward: 500,
    title: 'Near Beer Racket',
    flavor: '"They called it \'near beer.\' The customers called it strategy."',
    historyNote: 'Breweries legally produced low-alcohol "near beer" under Prohibition, while secretly siphoning off full-strength beer out the back for bootleggers.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Near_beer',
  },
  {
    id: 6, tier: 'easy', objectiveType: 'turns_without_arrest', params: { target: 5 }, reward: 800,
    title: 'Steady Hand',
    flavor: '"Five clean seasons — the cops ain\'t seen you yet."',
    historyNote: 'Successful operators like Owney Madden ran the Cotton Club for years by keeping a low public profile while competitors drew attention with flamboyance.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Owney_Madden',
  },
  {
    id: 7, tier: 'easy', objectiveType: 'sold_units_of_type', params: { target: 8, alcoholType: 'beer' }, reward: 700,
    title: 'Corner the Bar',
    flavor: '"Every speakeasy on the block orders from you now."',
    historyNote: 'At the height of Prohibition, New York City had an estimated 30,000 speakeasies — twice the number of saloons that existed before the 18th Amendment.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Speakeasy',
  },
  {
    id: 8, tier: 'easy', objectiveType: 'officials_bribed', params: { target: 1 }, reward: 500,
    title: 'Two-Bit Bribe',
    flavor: '"Every cop has a price. This one\'s cheap."',
    historyNote: 'Police corruption was so endemic during Prohibition that entire precincts were on bootlegger payrolls — in Chicago, Al Capone paid an estimated $75M/year in bribes.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Al_Capone',
  },
  {
    id: 9, tier: 'easy', objectiveType: 'total_cargo_units_gte', params: { target: 12 }, reward: 800,
    title: 'Produce Wagon',
    flavor: '"The wagon that looks like cabbages is hauling gold."',
    historyNote: 'Bootleggers routinely hid liquor inside legitimate freight — fruit crates, ice deliveries, caskets — to evade roadside inspections.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Rum-running',
  },
  {
    id: 10, tier: 'easy', objectiveType: 'cities_owned_gte', params: { target: 1 }, reward: 600,
    title: 'Home Turf',
    flavor: '"One flag. One territory. One beginning."',
    historyNote: 'Johnny Torrio methodically divided Chicago into gang territories to reduce violence — a model later adopted nationally by organized crime.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Johnny_Torrio',
  },
  {
    id: 11, tier: 'easy', objectiveType: 'cargo_units_of_type_gte', params: { target: 5, alcoholType: 'moonshine' }, reward: 500,
    title: 'Mountain Dew',
    flavor: '"Appalachian copper and rye. You didn\'t invent this — you inherited it."',
    historyNote: 'Appalachian moonshining predated Prohibition by over a century, but the 18th Amendment transformed local subsistence stilling into a national supply chain.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Moonshine',
  },
  {
    id: 12, tier: 'easy', objectiveType: 'distillery_tier_gte', params: { target: 2 }, reward: 1000,
    title: 'Backroom Still',
    flavor: '"Copper coils and patience. You\'re in business."',
    historyNote: 'Small illicit stills proliferated in urban basements and rural barns; the Bureau of Prohibition seized over 280,000 stills in 1925 alone.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Moonshine',
  },
  {
    id: 13, tier: 'easy', objectiveType: 'total_cash_earned', params: { target: 300 }, reward: 1500,
    title: 'First Earnin\'s',
    flavor: '"The first three hundred are the hardest. The next three thousand come faster."',
    historyNote: 'During Prohibition, the average bootlegger earned 3–4× a laborer\'s wage; the industry generated an estimated $3 billion annually by 1927.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Prohibition_in_the_United_States',
  },

  // ── Medium (14–26) ──────────────────────────────────────────────────────────
  {
    id: 14, tier: 'medium', objectiveType: 'cash_gte', params: { target: 3000 }, reward: 2000,
    title: 'War Chest',
    flavor: '"Three thousand keeps you liquid and dangerous."',
    historyNote: 'Al Capone\'s Chicago operation grossed an estimated $60M/year at its peak — cash reserves that funded political campaigns and bought law enforcement wholesale.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Al_Capone',
  },
  {
    id: 15, tier: 'medium', objectiveType: 'cities_owned_gte', params: { target: 3 }, reward: 2500,
    title: 'The Purple Grip',
    flavor: '"Detroit, Hamtramck, Windsor. The river is yours."',
    historyNote: 'The Purple Gang controlled liquor imports across the Detroit–Windsor corridor and supplied Al Capone\'s Chicago operation before consolidating three-city dominance.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Purple_Gang',
  },
  {
    id: 16, tier: 'medium', objectiveType: 'cities_visited', params: { target: 7 }, reward: 2000,
    title: 'Route Man',
    flavor: '"Seven towns — you know every back road and every sheriff\'s shift."',
    historyNote: 'Roy Olmstead built a sophisticated distribution network spanning dozens of Puget Sound communities, eventually employing over 90 people across multiple routes.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Roy_Olmstead',
  },
  {
    id: 17, tier: 'medium', objectiveType: 'total_sold_units', params: { target: 40 }, reward: 3000,
    title: 'Volume Business',
    flavor: '"Forty units moves the needle. Remus moved thousands."',
    historyNote: 'George Remus, a Cincinnati lawyer turned bootlegger, moved so much whiskey that prosecutors called him "the King of the Bootleggers" — he once threw a party for 100 guests and handed out cars as gifts.',
    wikiUrl: 'https://en.wikipedia.org/wiki/George_Remus',
  },
  {
    id: 18, tier: 'medium', objectiveType: 'heat_at_most', params: { target: 10 }, reward: 2500,
    title: 'Under Wraps',
    flavor: '"The best operation is the invisible one."',
    historyNote: 'Moe Dalitz ran the Cleveland bootlegging operation so quietly for years that law enforcement struggled to build a case — invisibility was his competitive advantage.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Moe_Dalitz',
  },
  {
    id: 19, tier: 'medium', objectiveType: 'sold_units_of_type', params: { target: 20, alcoholType: 'gin' }, reward: 2000,
    title: 'Bathtub Chemist',
    flavor: '"Industrial alcohol, juniper oil, and a bathtub. Don\'t ask questions."',
    historyNote: '"Bathtub gin" — grain alcohol redistilled with juniper and other botanicals in home bathtubs — became the dominant urban liquor of Prohibition because the equipment was cheap and gin needed no aging.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Bathtub_gin',
  },
  {
    id: 20, tier: 'medium', objectiveType: 'turns_without_arrest', params: { target: 10 }, reward: 3500,
    title: 'Clean Streak',
    flavor: '"Ten seasons free — you\'re better than they think."',
    historyNote: 'Eliot Ness and his Untouchables made 1,462 arrests by refusing bribes and maintaining meticulous records, but many operators evaded them for years simply by staying unpredictable.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Eliot_Ness',
  },
  {
    id: 21, tier: 'medium', objectiveType: 'officials_bribed', params: { target: 3 }, reward: 2000,
    title: 'On the Payroll',
    flavor: '"Three men in your pocket keeps three precincts blind."',
    historyNote: 'In Cicero, Illinois, Johnny Torrio\'s organization bribed an entire town government — the mayor, the police chief, and the city council — during the 1924 elections, reportedly at gunpoint.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Johnny_Torrio',
  },
  {
    id: 22, tier: 'medium', objectiveType: 'vehicles_owned_gte', params: { target: 2 }, reward: 2500,
    title: 'Fleet Manager',
    flavor: '"Two vehicles. Twice the reach. Twice the profit."',
    historyNote: 'Roy Olmstead operated a fleet of speedboats along Puget Sound and a network of fast automobiles inland — an integrated logistics operation that rivaled legitimate trucking companies.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Roy_Olmstead',
  },
  {
    id: 23, tier: 'medium', objectiveType: 'distillery_tier_gte', params: { target: 3 }, reward: 3000,
    title: 'Aging Tanks',
    flavor: '"Real aging takes time. Real money takes patience."',
    historyNote: 'George Remus purchased distilleries and drug stores under medicinal whiskey permits, then hijacked his own shipments with hired thugs to avoid paper trails connecting him to the resale.',
    wikiUrl: 'https://en.wikipedia.org/wiki/George_Remus',
  },
  {
    id: 24, tier: 'medium', objectiveType: 'cargo_units_of_type_gte', params: { target: 15, alcoholType: 'whiskey' }, reward: 2500,
    title: 'Canadian Gold',
    flavor: '"It crossed the border last night. It sells tonight."',
    historyNote: 'The Detroit–Windsor corridor became the primary entry point for Canadian whiskey into the US; the Purple Gang and later Capone\'s outfit controlled most of this flow.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Purple_Gang',
  },
  {
    id: 25, tier: 'medium', objectiveType: 'sabotages_completed', params: { target: 1 }, reward: 2000,
    title: 'Industrial Accident',
    flavor: '"A competitor\'s burned still is your open market."',
    historyNote: 'Gang rivalries during Prohibition frequently involved destroying rivals\' stills, hijacking deliveries, and burning warehouses — violence that escalated into the gang wars of the late 1920s.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Chicago_outfit',
  },
  {
    id: 26, tier: 'medium', objectiveType: 'total_cash_earned', params: { target: 2000 }, reward: 4000,
    title: 'The Rothstein Method',
    flavor: '"Arnold Rothstein didn\'t run liquor. He financed the men who did."',
    historyNote: 'Arnold Rothstein, the model for "The Great Gatsby\'s" Meyer Wolfsheim, bankrolled bootleggers across the Northeast while maintaining plausible deniability — pure financial leverage.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Arnold_Rothstein',
  },

  // ── Hard (27–39) ────────────────────────────────────────────────────────────
  {
    id: 27, tier: 'hard', objectiveType: 'cash_gte', params: { target: 8000 }, reward: 5000,
    title: 'Deep Pockets',
    flavor: '"Eight grand says you\'ve survived long enough to matter."',
    historyNote: 'Al Capone\'s personal fortune was estimated at $100M by 1930 — much of it in cash, since bootleggers avoided banks to prevent paper trails that could lead to tax evasion charges.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Al_Capone',
  },
  {
    id: 28, tier: 'hard', objectiveType: 'cities_owned_gte', params: { target: 5 }, reward: 6000,
    title: 'Territorial',
    flavor: '"Five cities. You\'re not a bootlegger. You\'re a baron."',
    historyNote: 'The Chicago Outfit divided the city and surrounding suburbs into protected territories after the 1919 peace conference organized by Johnny Torrio — violating another gang\'s territory meant war.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Chicago_outfit',
  },
  {
    id: 29, tier: 'hard', objectiveType: 'cities_visited', params: { target: 12 }, reward: 5000,
    title: 'The Long Haul',
    flavor: '"Twelve stops. One operation. You know every road agent and every loose plank."',
    historyNote: 'Bootleggers essentially invented modern long-haul trucking, establishing the first reliable coast-to-coast delivery networks; some routes later became the basis for US highway planning.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Rum-running',
  },
  {
    id: 30, tier: 'hard', objectiveType: 'total_sold_units', params: { target: 100 }, reward: 7000,
    title: 'Moving Units',
    flavor: '"A hundred units. The numbers men are impressed."',
    historyNote: 'George Remus at his peak controlled seven distilleries and moved an estimated 35% of all legal medicinal whiskey in the United States, coordinating hundreds of distribution points.',
    wikiUrl: 'https://en.wikipedia.org/wiki/George_Remus',
  },
  {
    id: 31, tier: 'hard', objectiveType: 'heat_at_most', params: { target: 5 }, reward: 6000,
    title: 'The Ghost',
    flavor: '"Heat of five. The law has no description on file for you."',
    historyNote: 'Prohibition agent Izzy Einstein boasted a 95% conviction rate by blending in — the operators he never caught were those who maintained absolutely no visible lifestyle.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Izzy_Einstein',
  },
  {
    id: 32, tier: 'hard', objectiveType: 'sold_units_of_type', params: { target: 50, alcoholType: 'rum' }, reward: 5500,
    title: 'Rum Row',
    flavor: '"Anchor three miles out. Wait for nightfall. Count your money."',
    historyNote: 'Rum Row was a line of ships anchored just outside US territorial waters off the Atlantic coast, openly selling to small speedboats; at its peak over 60 vessels sat waiting in the fleet.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Rum_Row',
  },
  {
    id: 33, tier: 'hard', objectiveType: 'turns_without_arrest', params: { target: 20 }, reward: 8000,
    title: 'Untouchable',
    flavor: '"Twenty seasons free. A legend walks among them."',
    historyNote: 'Eliot Ness\'s squad was dubbed "The Untouchables" after proving they could not be bribed — but the operators they never reached ran even cleaner.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Eliot_Ness',
  },
  {
    id: 34, tier: 'hard', objectiveType: 'officials_bribed', params: { target: 6 }, reward: 5000,
    title: 'The Fixers',
    flavor: '"Six men on the payroll. Six precincts blind."',
    historyNote: 'At the height of Chicago gang power, bribes reached the mayor\'s office: "Big Bill" Thompson\'s 1927 campaign was openly funded by Al Capone, who reportedly spent $260,000 on the election.',
    wikiUrl: 'https://en.wikipedia.org/wiki/William_Hale_Thompson',
  },
  {
    id: 35, tier: 'hard', objectiveType: 'vehicles_owned_gte', params: { target: 3 }, reward: 5500,
    title: 'Motorpool',
    flavor: '"Three vehicles. Three fronts. One empire."',
    historyNote: 'Bootleggers\' need for faster getaway cars directly drove demand for high-performance modifications — a tradition that eventually gave rise to NASCAR\'s origins in the mountain South.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Rum-running',
  },
  {
    id: 36, tier: 'hard', objectiveType: 'distillery_tier_gte', params: { target: 4 }, reward: 7000,
    title: 'The Remus Still',
    flavor: '"Four tiers of copper and knowledge. You distill better than the law allows."',
    historyNote: 'George Remus legally purchased the Fleischmann Distillery in Cincinnati among others, using medicinal whiskey permits to operate what were effectively full commercial operations hiding in plain sight.',
    wikiUrl: 'https://en.wikipedia.org/wiki/George_Remus',
  },
  {
    id: 37, tier: 'hard', objectiveType: 'cargo_units_of_type_gte', params: { target: 20, alcoholType: 'scotch' }, reward: 6000,
    title: 'Scotch Prestige',
    flavor: '"Imported, aged, coveted. You manufacture nothing — you acquire everything."',
    historyNote: 'Canadian and Bahamian brokers like Samuel Bronfman (Seagram\'s) supplied premium Scotch and whisky to US bootleggers who maintained quality at the top of the market throughout Prohibition.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Samuel_Bronfman',
  },
  {
    id: 38, tier: 'hard', objectiveType: 'sabotages_completed', params: { target: 3 }, reward: 5000,
    title: 'Wrecking Crew',
    flavor: '"Three rivals crippled. The market is yours."',
    historyNote: 'The 1929 St. Valentine\'s Day Massacre — in which Capone\'s men killed seven members of Bugs Moran\'s gang — was the culmination of years of tit-for-tat sabotage and assassination escalation.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Saint_Valentine%27s_Day_Massacre',
  },
  {
    id: 39, tier: 'hard', objectiveType: 'total_cash_earned', params: { target: 8000 }, reward: 8000,
    title: 'Big League',
    flavor: '"Eight thousand through your hands — you\'re a force to reckon with."',
    historyNote: 'Lucky Luciano reorganized the New York underworld in 1931, cutting deals across ethnic lines that transformed individual bootlegging operations into the modern American Mafia\'s financial structure.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Lucky_Luciano',
  },

  // ── Legendary (40–52) ───────────────────────────────────────────────────────
  {
    id: 40, tier: 'legendary', objectiveType: 'cash_gte', params: { target: 15000 }, reward: 10000,
    title: 'Millionaire',
    flavor: '"Fifteen grand in cash. Prohibition built you a fortune."',
    historyNote: 'George Remus amassed an estimated $40M during Prohibition — equivalent to over $700M today — before federal agents, led partly by his own wife\'s informing, dismantled his operation.',
    wikiUrl: 'https://en.wikipedia.org/wiki/George_Remus',
  },
  {
    id: 41, tier: 'legendary', objectiveType: 'cities_owned_gte', params: { target: 8 }, reward: 12000,
    title: 'Sovereign',
    flavor: '"Eight cities. This nation\'s thirst is your empire."',
    historyNote: 'The Chicago Outfit under Capone controlled bootlegging in not just Chicago but also Milwaukee, St. Louis, and parts of Ohio — a multi-city empire unprecedented in American organized crime.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Chicago_outfit',
  },
  {
    id: 42, tier: 'legendary', objectiveType: 'cities_visited', params: { target: 18 }, reward: 10000,
    title: 'Cartographer',
    flavor: '"You know every route, safe house, and crooked sheriff from here to the coast."',
    historyNote: 'Roy Olmstead\'s network spanned from the Canadian border down through Washington State with radio broadcasts used as coded delivery instructions — the first known use of broadcast radio for criminal logistics.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Roy_Olmstead',
  },
  {
    id: 43, tier: 'legendary', objectiveType: 'total_sold_units', params: { target: 200 }, reward: 13000,
    title: 'Volume King',
    flavor: '"Two hundred units supplied. You\'ve kept a city drinking for a year."',
    historyNote: 'By 1929, bootlegging was the sixth largest industry in the United States, generating more revenue annually than the steel or automobile industries.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Prohibition_in_the_United_States',
  },
  {
    id: 44, tier: 'legendary', objectiveType: 'heat_at_most', params: { target: 2 }, reward: 15000,
    title: 'The Invisible Man',
    flavor: '"Heat of two. The Feds have no file on you. You barely exist."',
    historyNote: 'Izzy Einstein and his partner Moe Smith made 4,932 arrests in five years — but the operators they never found were those with no visible wealth, no known associates, and no pattern to their movements.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Izzy_Einstein',
  },
  {
    id: 45, tier: 'legendary', objectiveType: 'sold_units_of_type', params: { target: 100, alcoholType: 'bourbon' }, reward: 11000,
    title: 'Bourbon Dynasty',
    flavor: '"A hundred barrels of Kentucky gold. Your legacy outlasts the law."',
    historyNote: 'Kentucky distillers held government permits to produce "medicinal bourbon" throughout Prohibition; six distilleries produced the only legal whiskey in the US, making Kentucky bourbon the gold standard of the era.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Bourbon_whiskey',
  },
  {
    id: 46, tier: 'legendary', objectiveType: 'turns_without_arrest', params: { target: 35 }, reward: 15000,
    title: 'Legend',
    flavor: '"Thirty-five seasons free. They write songs about operators like you."',
    historyNote: 'Prohibition lasted 13 years (1920–1933). The operators who survived its entire span without a federal conviction — like Moe Dalitz — emerged into the legitimate economy wealthy enough to build Las Vegas.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Moe_Dalitz',
  },
  {
    id: 47, tier: 'legendary', objectiveType: 'officials_bribed', params: { target: 10 }, reward: 12000,
    title: 'The Network',
    flavor: '"Ten men on the payroll. You own the law in three counties."',
    historyNote: 'Johnny Torrio\'s innovation was treating corruption as a systematic business expense rather than an ad hoc payment — his budgeted bribery network made Chicago law enforcement an arm of the organization.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Johnny_Torrio',
  },
  {
    id: 48, tier: 'legendary', objectiveType: 'vehicles_owned_gte', params: { target: 4 }, reward: 10000,
    title: 'Master Fleet',
    flavor: '"Four vehicles. Four fronts. Logistics is power."',
    historyNote: 'The Rum Row operation used fleets of motorized speedboats, modified trucks, and even aircraft; sophisticated operators maintained dedicated garages and mechanics as part of their overhead.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Rum_Row',
  },
  {
    id: 49, tier: 'legendary', objectiveType: 'distillery_tier_gte', params: { target: 5 }, reward: 14000,
    title: 'Empire Distillery',
    flavor: '"Tier Five. The masters distill. You command the masters."',
    historyNote: 'George Remus owned the Jack Daniel\'s and Fleischmann distilleries simultaneously, exploiting a medicinal permit loophole to run commercial-scale production that federal agents could not easily challenge.',
    wikiUrl: 'https://en.wikipedia.org/wiki/George_Remus',
  },
  {
    id: 50, tier: 'legendary', objectiveType: 'sabotages_completed', params: { target: 6 }, reward: 11000,
    title: 'Scorched Earth',
    flavor: '"Six rivals in ruins. The market is yours alone."',
    historyNote: 'The North Side–South Side gang war in Chicago (1924–1930) involved over 500 murders and destroyed dozens of bootlegging operations on both sides before Capone consolidated the market.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Saint_Valentine%27s_Day_Massacre',
  },
  {
    id: 51, tier: 'legendary', objectiveType: 'total_cargo_units_gte', params: { target: 40 }, reward: 10000,
    title: 'The Full Load',
    flavor: '"Forty units moving. Everything in motion, nothing at rest."',
    historyNote: 'Rum runners developed the first high-speed, purpose-built smuggling vessels — some capable of 40+ mph — outrunning Coast Guard cutters that topped out at 26 mph.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Rum-running',
  },
  {
    id: 52, tier: 'legendary', objectiveType: 'total_cash_earned', params: { target: 20000 }, reward: 15000,
    title: 'Kingpin',
    flavor: '"Twenty thousand through your hands. Prohibition made you a king."',
    historyNote: 'Al Capone\'s empire at its peak employed over 600 people directly and generated an estimated $105M/year — making him arguably the most successful entrepreneur in American history, illegal or otherwise.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Al_Capone',
  },
]

// ── Lookup helpers ─────────────────────────────────────────────────────────────

export function getMissionCard(id: number): MissionCard | undefined {
  return MISSION_CARDS.find(c => c.id === id)
}

/** Fisher-Yates shuffle — returns array of all 52 card IDs in random order */
export function shuffleDeck(): number[] {
  const ids = MISSION_CARDS.map(c => c.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  return ids
}

// ── Engine functions ───────────────────────────────────────────────────────────

/** Insert game_mission_deck row with shuffled deck for a new game */
export async function initMissionDeck(db: D1Database, gameId: string): Promise<void> {
  const deck = shuffleDeck()
  await db.prepare(
    `INSERT OR IGNORE INTO game_mission_deck (game_id, deck, discard) VALUES (?, ?, '[]')`
  ).bind(gameId, JSON.stringify(deck)).run()
}

/** Draw 2 cards per human player and insert into player_missions */
export async function dealInitialMissions(
  db: D1Database,
  gameId: string,
  humanPlayerIds: number[],
  season: number
): Promise<void> {
  for (const playerId of humanPlayerIds) {
    await drawMission(db, gameId, playerId, season)
    await drawMission(db, gameId, playerId, season)
  }
}

/** Pop a card from the deck (reshuffle discard if empty), insert player_missions row.
 *  Returns the card_id drawn, or null if no cards available. */
export async function drawMission(
  db: D1Database,
  gameId: string,
  playerId: number,
  season: number
): Promise<number | null> {
  const row = await db.prepare(
    `SELECT deck, discard FROM game_mission_deck WHERE game_id = ?`
  ).bind(gameId).first<{ deck: string; discard: string }>()

  if (!row) return null

  let deck: number[] = JSON.parse(row.deck)
  let discard: number[] = JSON.parse(row.discard)

  // Reshuffle discard into deck when empty
  if (deck.length === 0) {
    if (discard.length === 0) return null
    deck = discard.sort(() => Math.random() - 0.5)
    discard = []
  }

  const cardId = deck.pop()!

  await db.prepare(
    `UPDATE game_mission_deck SET deck = ?, discard = ? WHERE game_id = ?`
  ).bind(JSON.stringify(deck), JSON.stringify(discard), gameId).run()

  await db.prepare(
    `INSERT INTO player_missions (game_id, player_id, card_id, status, progress, assigned_season)
     VALUES (?, ?, ?, 'held', '{}', ?)`
  ).bind(gameId, playerId, cardId, season).run()

  return cardId
}

// ── Objective evaluation ───────────────────────────────────────────────────────

function evaluateObjective(card: MissionCard, snapshot: MissionSnapshot, progress: Record<string, unknown>): boolean {
  const target = Number(card.params.target)
  const alcoholType = card.params.alcoholType as string | undefined

  switch (card.objectiveType) {
    // ── Snapshot objectives ──────────────────────────────────────────────────
    case 'cash_gte':
      return snapshot.cash >= target
    case 'cities_owned_gte':
      return snapshot.citiesOwned >= target
    case 'vehicles_owned_gte':
      return snapshot.vehiclesOwned >= target
    case 'distillery_tier_gte':
      return snapshot.maxDistilleryTier >= target
    case 'total_cargo_units_gte':
      return snapshot.totalCargoUnits >= target
    case 'cargo_units_of_type_gte':
      return (snapshot.cargoByType[alcoholType ?? ''] ?? 0) >= target
    case 'heat_at_most':
      return snapshot.heat <= target
    case 'heat_at_least':
      return snapshot.heat >= target

    // ── Cumulative objectives ────────────────────────────────────────────────
    case 'total_sold_units': {
      const sold = progress.sold_units as Record<string, number> | undefined
      const total = sold ? Object.values(sold).reduce((s, v) => s + v, 0) : 0
      return total >= target
    }
    case 'sold_units_of_type': {
      const sold = progress.sold_units as Record<string, number> | undefined
      return (sold?.[alcoholType ?? ''] ?? 0) >= target
    }
    case 'total_cash_earned':
      return snapshot.totalCashEarned >= target
    case 'officials_bribed':
      return (Number(progress.officials_bribed) || 0) >= target
    case 'cities_visited': {
      const visited = progress.visited_city_ids as number[] | undefined
      return (visited?.length ?? 0) >= target
    }
    case 'turns_without_arrest':
      return snapshot.consecutiveCleanSeasons >= target
    case 'sabotages_completed':
      return (Number(progress.sabotages_completed) || 0) >= target

    default:
      return false
  }
}

/** Check all held missions for the player, complete qualifying ones, pay rewards.
 *  Does NOT auto-draw new cards. */
export async function checkAndCompleteMissions(
  db: D1Database,
  gameId: string,
  playerId: number,
  season: number,
  snapshot: MissionSnapshot
): Promise<{ completedCardIds: number[]; totalReward: number }> {
  const { results: held } = await db.prepare(
    `SELECT id, card_id, progress FROM player_missions
     WHERE player_id = ? AND status = 'held'`
  ).bind(playerId).all<{ id: number; card_id: number; progress: string }>()

  const completedCardIds: number[] = []
  let totalReward = 0

  for (const row of held) {
    const card = getMissionCard(row.card_id)
    if (!card) continue

    const progress = JSON.parse(row.progress) as Record<string, unknown>
    if (!evaluateObjective(card, snapshot, progress)) continue

    // Mark complete and pay reward
    await db.prepare(
      `UPDATE player_missions SET status = 'completed', completed_season = ?, reward_paid = 1 WHERE id = ?`
    ).bind(season, row.id).run()
    await db.prepare(
      `UPDATE game_players SET cash = cash + ? WHERE id = ?`
    ).bind(card.reward, playerId).run()
    // Move card to discard
    await db.prepare(
      `UPDATE game_mission_deck SET discard = json_insert(discard, '$[#]', ?) WHERE game_id = ?`
    ).bind(row.card_id, gameId).run()

    completedCardIds.push(row.card_id)
    totalReward += card.reward
  }

  return { completedCardIds, totalReward }
}

/** Update cumulative progress for held missions that track this event type */
export async function updateCumulativeProgress(
  db: D1Database,
  playerId: number,
  event: CumulativeEvent
): Promise<void> {
  // Fetch held missions that have cumulative objectives
  const cumulativeTypes: MissionObjectiveType[] = [
    'total_sold_units', 'sold_units_of_type', 'officials_bribed',
    'cities_visited', 'sabotages_completed',
  ]

  const { results: held } = await db.prepare(
    `SELECT id, card_id, progress FROM player_missions WHERE player_id = ? AND status = 'held'`
  ).bind(playerId).all<{ id: number; card_id: number; progress: string }>()

  for (const row of held) {
    const card = getMissionCard(row.card_id)
    if (!card || !cumulativeTypes.includes(card.objectiveType)) continue

    const progress = JSON.parse(row.progress) as Record<string, unknown>
    let updated = false

    if (event.type === 'sold_units' && (card.objectiveType === 'total_sold_units' || card.objectiveType === 'sold_units_of_type')) {
      const sold = (progress.sold_units ?? {}) as Record<string, number>
      sold[event.alcoholType] = (sold[event.alcoholType] ?? 0) + event.quantity
      progress.sold_units = sold
      updated = true
    } else if (event.type === 'official_bribed' && card.objectiveType === 'officials_bribed') {
      progress.officials_bribed = (Number(progress.officials_bribed) || 0) + 1
      updated = true
    } else if (event.type === 'city_visited' && card.objectiveType === 'cities_visited') {
      const visited = (progress.visited_city_ids ?? []) as number[]
      if (!visited.includes(event.cityId)) {
        visited.push(event.cityId)
        progress.visited_city_ids = visited
        updated = true
      }
    } else if (event.type === 'sabotage_completed' && card.objectiveType === 'sabotages_completed') {
      progress.sabotages_completed = (Number(progress.sabotages_completed) || 0) + 1
      updated = true
    }

    if (updated) {
      await db.prepare(
        `UPDATE player_missions SET progress = ? WHERE id = ?`
      ).bind(JSON.stringify(progress), row.id).run()
    }
  }
}
