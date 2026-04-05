// ── Prohibition Times — Newspaper content data ──────────────────────────────
// Static curated stories, opinions, and advertisements for the in-game newspaper.
// Stories are era-matched by year (1920–1933) to the current season.
// Season → Year: 1920 + Math.floor((season - 1) / 4)

export type StoryType = 'news' | 'opinion' | 'ad'
export type StorySize = 'banner' | 'feature' | 'brief'

export interface ProhibitionStory {
  id: string
  type: StoryType
  year: number          // 1920–1933 for era matching; 0 = wild-card (any year)
  headline: string
  subheadline?: string
  body: string          // 2–4 sentences
  imageUrl?: string     // Wikipedia Commons or Library of Congress URL
  sourceUrl?: string    // Link to actual historical source/article
  size: StorySize
}

export const PROHIBITION_STORIES: ProhibitionStory[] = [

  // ── 1920 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1920-volstead',
    type: 'news', year: 1920, size: 'banner',
    headline: 'VOLSTEAD ACT NOW LAW OF THE LAND',
    subheadline: 'Nation Goes Dry as Eighteenth Amendment Takes Full Effect',
    body: 'The National Prohibition Act, shepherded through Congress by Rep. Andrew Volstead of Minnesota, has taken full effect across the United States. Sale, manufacture, and transportation of intoxicating liquors are henceforth illegal. Authorities promise strict enforcement, though critics warn the law will prove unenforceable in the nation\'s great cities.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/VolsteadAct.jpg/320px-VolsteadAct.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Volstead_Act',
  },
  {
    id: 'news-1920-rum-row',
    type: 'news', year: 1920, size: 'feature',
    headline: 'SHIPS LADEN WITH LIQUOR ANCHOR JUST BEYOND TERRITORIAL LIMIT',
    subheadline: '"Rum Row" Defies Coast Guard off New York Harbor',
    body: 'A fleet of vessels carrying foreign spirits has taken anchor three miles offshore, just beyond the reach of federal law. Small, fast motorboats make nightly runs to shore, outpacing the Revenue Cutter Service with alarming ease. Treasury officials are calling for expanded naval patrols, while New York barkeeps quietly report no shortage of supply.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Rum_Row_ships.jpg/320px-Rum_Row_ships.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Rum_Row',
  },
  {
    id: 'news-1920-izzy',
    type: 'news', year: 1920, size: 'feature',
    headline: 'FEDERAL AGENT IZZY EINSTEIN BAGS 65 BOOTLEGGERS IN FIRST MONTH',
    subheadline: 'Portly Prohibition Agent Uses Disguises to Catch Violators Off Guard',
    body: 'Isidor "Izzy" Einstein, a former postal clerk turned Prohibition agent, has become the terror of New York\'s underground liquor trade. Disguised variously as a fisherman, a football player, and a Talmudic scholar, Einstein has secured 65 arrests in his first thirty days on the job. "The thirst for justice," he told reporters, "is greater than the thirst for gin."',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Izzy_Einstein.jpg/240px-Izzy_Einstein.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Izzy_and_Moe',
  },

  // ── 1921 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1921-chicago-gangs',
    type: 'news', year: 1921, size: 'banner',
    headline: 'CHICAGO GANG WARS LEAVE THREE DEAD ON WABASH AVENUE',
    subheadline: 'South Side and North Side Factions Contest Control of Lucrative Hooch Routes',
    body: 'Violence erupted on Wabash Avenue late Tuesday when gunmen affiliated with the South Side liquor syndicate ambushed a delivery convoy crossing into rival territory. Three men were killed and two wounded in an exchange described by witnesses as a "regular battle." Police arrived to find only shell casings and a shattered delivery truck. No arrests have been made.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Chicago_gangsters_1920s.jpg/320px-Chicago_gangsters_1920s.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Chicago_Outfit',
  },
  {
    id: 'news-1921-grape-bricks',
    type: 'news', year: 1921, size: 'feature',
    headline: 'GRAPE GROWERS REPORT RECORD SALES AS HOME WINEMAKING BOOMS',
    subheadline: 'Volstead Act Permits Head-of-Household to Produce 200 Gallons Annually',
    body: 'California grape growers are shipping record tonnage eastward as Americans take advantage of a little-noticed provision in the Volstead Act permitting households to produce up to 200 gallons of "non-intoxicating cider and fruit juices" per year. Enterprising vintners now sell "Vine-Glo" concentrate blocks with labels warning: "After dissolving in water, do not place in a warm location for twenty days, as this will cause fermentation."',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Vine-Glo_brick.jpg/240px-Vine-Glo_brick.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Vine-Glo',
  },
  {
    id: 'news-1921-speakeasy',
    type: 'news', year: 1921, size: 'brief',
    headline: 'SPEAKEASY COUNT IN MANHATTAN ESTIMATED AT 5,000 AND RISING',
    body: 'A survey commissioned by the Anti-Saloon League estimates that no fewer than 5,000 illicit drinking establishments now operate in Manhattan alone — more than double the number of legal saloons before Prohibition. "The law is being openly flouted," the League\'s report admits, "in every ward of the city."',
    sourceUrl: 'https://en.wikipedia.org/wiki/Speakeasy',
  },

  // ── 1922 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1922-torrio',
    type: 'news', year: 1922, size: 'banner',
    headline: 'TORRIO SYNDICATE CONTROLS BOOTLEG SUPPLY TO FOUR COUNTIES',
    subheadline: 'Former New York Operator Builds Chicago Empire from Capone\'s Back Office',
    body: 'Johnny Torrio, a mild-mannered Brooklynite who prefers negotiation to violence, has quietly consolidated control over the bootleg supply to Cook, DuPage, Kane, and Lake counties in Illinois. Operating out of the Four Deuces on South Wabash, Torrio employs hundreds and grosses an estimated $4 million annually. His lieutenant, a young man named Alphonse Capone, handles day-to-day enforcement.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Johnny_Torrio_1920s.jpg/240px-Johnny_Torrio_1920s.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Johnny_Torrio',
  },
  {
    id: 'news-1922-coast-guard',
    type: 'news', year: 1922, size: 'feature',
    headline: 'COAST GUARD SEIZES RECORD 12,000 CASES OF SCOTCH WHISKY OFF JERSEY SHORE',
    body: 'Revenue agents intercepted the schooner *Tomoka* early Thursday morning, finding her hold packed with 12,000 cases of Scotch whisky bound for New York buyers. The haul is the largest single seizure since the Volstead Act took effect. The vessel\'s captain claimed he was carrying molasses from the Bahamas; agents noted that molasses seldom travels in labeled bottles.',
    sourceUrl: 'https://en.wikipedia.org/wiki/United_States_Coast_Guard_and_Prohibition',
  },
  {
    id: 'news-1922-industrial',
    type: 'news', year: 1922, size: 'brief',
    headline: 'GOVERNMENT ORDERS INDUSTRIAL ALCOHOL ADULTERATED WITH POISON TO DETER THEFT',
    body: 'The Treasury Department has quietly mandated that industrial alcohol — legally available for manufacturing purposes — be "denatured" with methanol, benzene, and other toxic agents to deter diversion into the bootleg supply. Critics warn that unscrupulous operators will redistill the tainted spirit regardless, putting drinkers at grave risk.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Chemist%27s_war',
  },

  // ── 1923 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1923-harding',
    type: 'news', year: 1923, size: 'banner',
    headline: 'PRESIDENT HARDING DEAD AT 57; COOLIDGE TAKES OATH',
    subheadline: 'Teapot Dome Scandals Cloud Legacy of 29th President',
    body: 'President Warren G. Harding died suddenly in San Francisco on August 2nd, shocking the nation. Vice President Calvin Coolidge, vacationing at his Vermont farm, was sworn in by his father, a notary public, by lamplight. Harding\'s sudden death has forestalled a congressional investigation into corruption at the Interior Department, though critics vow to press forward.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Warren_G_Harding-Harris_%26_Ewing.jpg/240px-Warren_G_Harding-Harris_%26_Ewing.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Warren_G._Harding',
  },
  {
    id: 'news-1923-izzy-fired',
    type: 'news', year: 1923, size: 'feature',
    headline: 'PROHIBITION BUREAU DISMISSES EINSTEIN AND MOE — TOO MUCH PUBLICITY',
    body: 'Isidor Einstein and his partner Moe Smith, the most celebrated Prohibition agents in the country, have been dismissed by the Bureau of Prohibition. Officials cited "too much publicity" as the grounds for termination. In four years of service the pair made 4,932 arrests and confiscated five million bottles of liquor; their sacking was greeted with dismay by the temperance press and barely concealed glee by New York\'s thirsty population.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Izzy_Einstein.jpg/240px-Izzy_Einstein.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Izzy_and_Moe',
  },
  {
    id: 'news-1923-medicinal',
    type: 'news', year: 1923, size: 'brief',
    headline: 'DOCTORS WRITE 11 MILLION WHISKEY PRESCRIPTIONS IN CALENDAR YEAR',
    body: 'The American Medical Association reports that physicians wrote approximately 11 million prescriptions for "medicinal whiskey" in 1922, generating $40 million in fees. Walgreen\'s drugstore chain has expanded from 20 locations to over 200 since Prohibition began, fueled largely by its pharmaceutical spirits business.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Medicinal_use_of_alcohol_during_Prohibition',
  },

  // ── 1924 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1924-capone-rise',
    type: 'news', year: 1924, size: 'banner',
    headline: 'AL CAPONE ASSUMES COMMAND OF CHICAGO OUTFIT AFTER TORRIO SHOOTING',
    subheadline: 'Torrio Survives Assassination Attempt; Retires to Italy',
    body: 'Johnny Torrio, wounded in a brazen daylight shooting outside his home on Clyde Avenue, has handed control of Chicago\'s vast bootleg empire to his twenty-five year old lieutenant, Alphonse Capone. Torrio told associates he is "through with the rackets" and has booked passage to Italy. Capone, who prefers to be called "Scarface" by no one, is expected to run the operation with considerably less subtlety than his predecessor.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Al_Capone_in_1930.jpg/240px-Al_Capone_in_1930.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Al_Capone',
  },
  {
    id: 'news-1924-deanie-obanion',
    type: 'news', year: 1924, size: 'feature',
    headline: 'FLORIST AND NORTH SIDE GANG BOSS DION O\'BANION SHOT DEAD IN HIS SHOP',
    subheadline: 'Three Gunmen Enter Schofield\'s Flower Shop; Proprietor Dies Clutching Chrysanthemums',
    body: 'Dean O\'Banion, florist and leader of the North Side Gang, was shot dead in his flower shop on North State Street yesterday afternoon. Three men entered on the pretext of purchasing flowers for a funeral; one shook O\'Banion\'s hand and held it while the others fired six shots. Chicago police profess themselves baffled.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Dean_O%27Banion',
  },
  {
    id: 'news-1924-border-patrol',
    type: 'news', year: 1924, size: 'brief',
    headline: 'BORDER PATROL ESTABLISHED TO STEM FLOOD OF CANADIAN WHISKY',
    body: 'Congress has established the United States Border Patrol to guard the nation\'s land frontiers. Lawmakers specifically cited the unimpeded flow of Canadian whisky across the northern border as a primary motivation. Agents in Detroit report that bootleggers are using underwater pipelines, fake fishing boats, and in winter, automobiles driven across the frozen Detroit River.',
    sourceUrl: 'https://en.wikipedia.org/wiki/United_States_Border_Patrol',
  },

  // ── 1925 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1925-scopes',
    type: 'news', year: 1925, size: 'banner',
    headline: 'SCOPES "MONKEY TRIAL" GRIPS NATION AS TENNESSEE TEACHER STANDS ACCUSED',
    subheadline: 'Darrow Squares Off Against Bryan in Dayton Courtroom; Nation Divided',
    body: 'John T. Scopes, a high school biology teacher in Dayton, Tennessee, has gone on trial for violating the Butler Act, which prohibits the teaching of evolutionary theory in public schools. Clarence Darrow leads the defense; William Jennings Bryan, three-time presidential candidate and champion of temperance, argues for the prosecution. H. L. Mencken reports daily from Dayton in characteristically uncharitable terms.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/John_Scopes.jpg/240px-John_Scopes.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Scopes_Trial',
  },
  {
    id: 'news-1925-capone-cicero',
    type: 'news', year: 1925, size: 'feature',
    headline: 'CAPONE MOVES HEADQUARTERS TO CICERO; CONTROLS ENTIRE SUBURB',
    body: 'Al Capone has relocated his criminal headquarters to the Hotel Hawthorne in Cicero, Illinois, a move observers attribute to increasing heat from Chicago\'s new reform mayor. Capone now controls every speakeasy, gambling den, and brothel in Cicero and reportedly receives tribute from the town\'s elected officials. A revenue agent who visited the Hawthorne described it as "the best-run hotel in the western suburbs."',
    sourceUrl: 'https://en.wikipedia.org/wiki/Al_Capone',
  },
  {
    id: 'news-1925-great-gatsby',
    type: 'news', year: 1925, size: 'brief',
    headline: 'NEW NOVEL BY FITZGERALD DEPICTS BOOTLEGGER AS ROMANTIC HERO',
    body: 'F. Scott Fitzgerald\'s new novel "The Great Gatsby" has been published to mixed reviews but brisk sales. The book centers on a mysterious Long Island millionaire of uncertain fortune who throws lavish parties and is rumored to be connected to "drug stores" — a common euphemism for bootleg operations. Literary critics differ on whether Fitzgerald romanticizes or condemns his subject.',
    sourceUrl: 'https://en.wikipedia.org/wiki/The_Great_Gatsby',
  },

  // ── 1926 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1926-hymie-weiss',
    type: 'news', year: 1926, size: 'banner',
    headline: 'NORTH SIDE CHIEF HYMIE WEISS MACHINE-GUNNED OUTSIDE HOLY NAME CATHEDRAL',
    subheadline: 'Chicago Gang War Claims Ninth Leader in Eighteen Months',
    body: 'Earl "Hymie" Weiss, leader of the North Side Gang and sworn enemy of Al Capone, was shot down by machine gun fire outside Holy Name Cathedral on North State Street yesterday. The killing is the ninth assassination of a major gang figure in Chicago in the past eighteen months. Police superintendent Morgan Collins called the situation "a disgrace" and promised action; bookmakers in the Loop were offering even odds on how long Collins himself would last in the job.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Hymie_Weiss',
  },
  {
    id: 'news-1926-coast-guard-rum',
    type: 'news', year: 1926, size: 'feature',
    headline: 'COAST GUARD ACQUIRES FLEET OF FAST CUTTERS TO COMBAT RUM RUNNING',
    body: 'The Treasury Department has completed delivery of twenty new high-speed patrol cutters capable of exceeding thirty knots, specifically designed to run down the fast rumrunners operating off the Eastern Seaboard. Bootleggers have responded by acquiring converted Liberty engines capable of even greater speeds. Marine engineers on both sides of the law report a brisk business in engine upgrades.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/USCGC_Mojave_1926.jpg/320px-USCGC_Mojave_1926.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/United_States_Coast_Guard_and_Prohibition',
  },
  {
    id: 'news-1926-corruption',
    type: 'news', year: 1926, size: 'brief',
    headline: 'SENATE COMMITTEE HEARS TESTIMONY THAT HALF OF CHICAGO POLICE ON BOOTLEGGER PAYROLL',
    body: 'Testimony before the Senate Prohibition Investigation Committee suggests that upwards of half of Chicago\'s 6,000-man police force receives regular payments from bootlegging interests. A former precinct captain testified that the going rate for protection of a single speakeasy was $75 per month, with larger establishments paying proportionally more.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Prohibition_in_the_United_States',
  },

  // ── 1927 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1927-lindbergh',
    type: 'news', year: 1927, size: 'banner',
    headline: 'LINDBERGH CROSSES ATLANTIC SOLO IN 33½ HOURS — PARIS GOES MAD WITH JOY',
    subheadline: 'Young Mail Pilot in Spirit of St. Louis Completes First Nonstop New York–Paris Flight',
    body: 'Charles A. Lindbergh, a 25-year-old airmail pilot from Minnesota, landed his monoplane Spirit of St. Louis at Le Bourget Field outside Paris at 10:22 PM local time, completing the first solo nonstop transatlantic flight in history. An estimated 100,000 Parisians stormed the airfield. President Coolidge dispatched a naval cruiser to bring the hero home. The flight has been universally acclaimed as proof that America\'s spirit is undiminished.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Charles_Lindbergh_and_the_Spirit_of_St._Louis_%28Crisco_restoration%2C_large%29.jpg/320px-Charles_Lindbergh_and_the_Spirit_of_St._Louis_%28Crisco_restoration%2C_large%29.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Transatlantic_flight_of_Charles_Lindbergh',
  },
  {
    id: 'news-1927-purple-gang',
    type: 'news', year: 1927, size: 'feature',
    headline: 'DETROIT\'S PURPLE GANG EXTENDS BOOTLEG REACH TO FIVE STATES',
    body: 'The Purple Gang, a Detroit-based syndicate that controls the bulk of Canadian whisky flowing across the Detroit River, has expanded its distribution network to Ohio, Indiana, Pennsylvania, and Michigan, according to federal investigators. The gang is known for its willingness to murder rivals without negotiation. Al Capone, who attempted to muscle in on their territory, reportedly sent a diplomatic delegation instead after three of his men failed to return.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Purple_Gang',
  },
  {
    id: 'news-1927-sacco-vanzetti',
    type: 'news', year: 1927, size: 'brief',
    headline: 'SACCO AND VANZETTI EXECUTED AFTER SIX YEARS OF CONTROVERSY',
    body: 'Nicola Sacco and Bartolomeo Vanzetti, Italian immigrants convicted of murder in a controversial 1921 trial, were executed in the electric chair at Charlestown State Prison early this morning. Protests erupted in Paris, London, and Buenos Aires; in Boston, National Guardsmen with fixed bayonets kept crowds from the prison gates. Governor Fuller declined to grant clemency.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Sacco_and_Vanzetti',
  },

  // ── 1928 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1928-hoover',
    type: 'news', year: 1928, size: 'banner',
    headline: 'HOOVER ELECTED IN LANDSLIDE; VOWS STRICTER ENFORCEMENT OF PROHIBITION',
    subheadline: 'Commerce Secretary Defeats Al Smith; First Catholic Presidential Candidate Carries Only 8 States',
    body: 'Herbert Hoover has won the presidency in a decisive victory over New York Governor Al Smith, carrying 40 states and 444 electoral votes. Hoover, who called Prohibition "a great social and economic experiment, noble in motive," promised rigorous enforcement and a reorganization of the corrupted Prohibition Bureau. Smith\'s Catholicism and his outspoken opposition to Prohibition were widely cited as factors in his defeat.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Herbert_Hoover_as_Secretary_of_Commerce.jpg/240px-Herbert_Hoover_as_Secretary_of_Commerce.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/1928_United_States_presidential_election',
  },
  {
    id: 'news-1928-machines',
    type: 'news', year: 1928, size: 'feature',
    headline: 'THOMPSON SUB-MACHINE GUN BECOMES WEAPON OF CHOICE IN GANG WARS',
    body: 'The Thompson sub-machine gun, developed during the war as a "trench broom" and subsequently a commercial failure, has found a lucrative second market among bootlegging syndicates. The weapon, capable of firing 800 rounds per minute, is responsible for an estimated 40 percent of gang-related homicides in Chicago and Detroit. Its manufacturer, Auto-Ordnance Corporation, sold the weapons legally to any buyer for $200 apiece until recently tightening sales policies.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Thompson_M1928.jpg/320px-Thompson_M1928.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Thompson_submachine_gun',
  },
  {
    id: 'news-1928-bugs-moran',
    type: 'news', year: 1928, size: 'brief',
    headline: 'BUGS MORAN SWEARS REVENGE AFTER CAPONE HIJACKS NORTH SIDE WHISKY CONVOY',
    body: 'George "Bugs" Moran, who inherited leadership of the North Side Gang after the murders of O\'Banion and Weiss, has reportedly vowed revenge against Al Capone\'s South Side organization following the hijacking of a truck convoy carrying $30,000 worth of Canadian whisky. Moran was heard telling associates that he intends to "bury Capone in his own cement."',
    sourceUrl: 'https://en.wikipedia.org/wiki/Bugs_Moran',
  },

  // ── 1929 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1929-massacre',
    type: 'news', year: 1929, size: 'banner',
    headline: 'SEVEN MEN SLAUGHTERED IN CHICAGO GARAGE ON ST. VALENTINE\'S DAY',
    subheadline: 'Gunmen in Police Uniforms Execute Moran Gang Members; Capone Denies Involvement from Florida',
    body: 'Seven members of the Bugs Moran gang were lined against the wall of a Clark Street garage and executed by machine gun fire on Valentine\'s Day morning. The killers, at least two of whom wore police uniforms, escaped in a black sedan. Moran himself arrived late to the meeting and escaped. "Only Capone kills like that," Moran told reporters. Capone, reached at his Palm Island estate in Florida, expressed surprise and condolences.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Saint_Valentines_Day_Massacre_site_1929.jpg/320px-Saint_Valentines_Day_Massacre_site_1929.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Saint_Valentine%27s_Day_Massacre',
  },
  {
    id: 'news-1929-crash',
    type: 'news', year: 1929, size: 'banner',
    headline: 'WALL STREET IN PANIC; STOCKS COLLAPSE IN RECORD TRADING',
    subheadline: 'Billions Lost as Markets Plunge; Brokers Mob Exchange Floor',
    body: 'The New York Stock Exchange experienced its worst single-day collapse in history on Black Tuesday, as panicked selling sent values plummeting by billions of dollars. Scenes of chaos on the Exchange floor were repeated at brokerage houses across the country. President Hoover issued a statement assuring Americans that the "fundamental business of the country" remains sound. Economists are less certain.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Crowd_outside_nyse.jpg/320px-Crowd_outside_nyse.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Wall_Street_Crash_of_1929',
  },
  {
    id: 'news-1929-wickersham',
    type: 'news', year: 1929, size: 'brief',
    headline: 'HOOVER APPOINTS COMMISSION TO STUDY PROHIBITION ENFORCEMENT',
    body: 'President Hoover has named former Attorney General George Wickersham to chair a commission charged with evaluating the effectiveness of Prohibition enforcement. Critics from both the Wet and Dry camps greeted the appointment with skepticism. Senator James Reed of Missouri predicted that the commission would "study the situation to death while the bootleggers count their money."',
    sourceUrl: 'https://en.wikipedia.org/wiki/Wickersham_Commission',
  },

  // ── 1930 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1930-capone-tax',
    type: 'news', year: 1930, size: 'banner',
    headline: 'FEDERAL PROSECUTORS BUILD TAX EVASION CASE AGAINST CAPONE',
    subheadline: 'IRS Agents Reconstruct Years of Unreported Income from Bootleg Empire',
    body: 'The Internal Revenue Service, working in parallel with Prohibition Bureau agents, is assembling a case against Al Capone based on tax evasion rather than liquor violations. Capone\'s attorneys have long maintained their client has no demonstrable income; IRS special agent Frank Wilson has spent three years tracing cash flows through a labyrinth of front companies and corrupt bankers. Capone\'s estimated annual income of $60 million has never been reported to the government.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Al_Capone_in_1930.jpg/240px-Al_Capone_in_1930.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Al_Capone',
  },
  {
    id: 'news-1930-depression',
    type: 'news', year: 1930, size: 'feature',
    headline: 'UNEMPLOYMENT ROLLS SWELL TO 4 MILLION AS DEPRESSION DEEPENS',
    body: 'The national unemployment rate has reached an estimated 8.7 percent, with breadlines stretching around city blocks in New York, Chicago, and Detroit. President Hoover has repeatedly declined to authorize direct federal relief, maintaining that private charity and local government are adequate to the task. Saloon keepers who went out of business in 1920 note with grim humor that business might otherwise be quite good.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Great_Depression_in_the_United_States',
  },
  {
    id: 'news-1930-wickersham-report',
    type: 'news', year: 1930, size: 'brief',
    headline: 'WICKERSHAM REPORT FINDS PROHIBITION UNENFORCEABLE BUT RECOMMENDS CONTINUATION',
    body: 'The Wickersham Commission has issued a report acknowledging that Prohibition is widely violated, that enforcement is riddled with corruption, and that the law has enriched criminals while failing to reduce drinking. The Commission nevertheless recommends that Prohibition continue. The New York World published the eleven commissioners\' individual views alongside the official conclusion and noted that most of the commissioners privately favored repeal.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Wickersham_Commission',
  },

  // ── 1931 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1931-capone-convicted',
    type: 'news', year: 1931, size: 'banner',
    headline: 'CAPONE GUILTY ON TAX COUNTS; SENTENCED TO 11 YEARS IN FEDERAL PRISON',
    subheadline: 'Chicago\'s Most Feared Crime Lord to Report to Cook County Jail Pending Appeal',
    body: 'Al Capone was convicted yesterday in federal district court on five counts of income tax evasion and sentenced to eleven years in prison and $50,000 in fines. The verdict ends a decade-long reign over Chicago\'s underworld. Judge James Wilkerson, who had been tipped that Capone\'s attorneys planned to bribe the jury, switched the entire panel at the last moment. Capone smiled throughout sentencing and told reporters it was "a bum rap."',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Al_Capone_in_1930.jpg/240px-Al_Capone_in_1930.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Al_Capone',
  },
  {
    id: 'news-1931-empire-state',
    type: 'news', year: 1931, size: 'feature',
    headline: 'EMPIRE STATE BUILDING OPENS AS WORLD\'S TALLEST STRUCTURE',
    subheadline: '102-Story Tower Completed in Record 410 Days; President Hoover Illuminates Tower from Washington',
    body: 'The Empire State Building, standing 1,250 feet above Fifth Avenue, has officially opened to the public. President Hoover threw a switch in Washington that lit up the tower\'s beacon. The building\'s developers have had difficulty finding tenants in the depressed real estate market; wags have taken to calling it the "Empty State Building." Its observation deck drew 3,000 visitors on opening day.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Empire_State_Building_%28aerial_view%29.jpg/240px-Empire_State_Building_%28aerial_view%29.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Empire_State_Building',
  },
  {
    id: 'news-1931-eliot-ness',
    type: 'news', year: 1931, size: 'brief',
    headline: 'TREASURY AGENT NESS AND "UNTOUCHABLES" RAID CAPONE BREWERIES',
    body: 'Eliot Ness, a 28-year-old Treasury agent leading a hand-picked team of incorruptible agents, has staged a series of headline-grabbing raids on breweries and distilleries linked to the Capone organization. Ness reportedly invited newspaper photographers along to each raid, ensuring maximum publicity. Capone\'s men reportedly offered Ness $2,000 a week in bribes; he declined.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Eliot_Ness',
  },

  // ── 1932 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1932-fdr',
    type: 'news', year: 1932, size: 'banner',
    headline: 'ROOSEVELT WINS IN HISTORIC LANDSLIDE; PLEDGES "NEW DEAL" FOR AMERICA',
    subheadline: 'Democrat Carries 42 States; Hoover Carries 6; Repeal of Prohibition Seen as Certainty',
    body: 'Franklin D. Roosevelt has been elected the 32nd President of the United States in one of the largest electoral margins in the nation\'s history, carrying 42 states and 472 electoral votes. Roosevelt, who campaigned openly for Prohibition repeal and a sweeping program of economic relief, told supporters in New York that "a new chapter in our national life is about to be written." Drys expressed alarm; the nation\'s bootleggers began quietly surveying their options.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/FDR_1944_Color_Portrait.jpg/240px-FDR_1944_Color_Portrait.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Franklin_D._Roosevelt',
  },
  {
    id: 'news-1932-lindbergh-kidnapping',
    type: 'news', year: 1932, size: 'feature',
    headline: 'LINDBERGH BABY KIDNAPPED FROM NEW JERSEY HOME; $50,000 RANSOM DEMANDED',
    body: 'Charles A. Lindbergh Jr., the 20-month-old son of America\'s most famous aviator, was taken from his crib at the Lindbergh estate near Hopewell, New Jersey, in the early morning hours. A ransom note demanding $50,000 was found on the nursery windowsill. President Hoover placed federal investigators at Colonel Lindbergh\'s disposal. The case has gripped the nation as no crime story since the Prohibition murders of Chicago.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Lindbergh_kidnapping',
  },
  {
    id: 'news-1932-bonus-army',
    type: 'news', year: 1932, size: 'brief',
    headline: 'ARMY ROUTS BONUS MARCHERS FROM WASHINGTON; HOOVER ORDERS ACTION',
    body: 'General Douglas MacArthur, acting on President Hoover\'s orders, has dispersed the Bonus Expeditionary Force — 20,000 World War veterans camped in Washington demanding early payment of service bonuses. Troops with fixed bayonets, tanks, and tear gas drove the marchers from their Anacostia shantytown and burned their tents. The action has outraged veterans\' groups and is expected to hasten Hoover\'s already likely defeat in November.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Bonus_Army',
  },

  // ── 1933 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1933-repeal',
    type: 'news', year: 1933, size: 'banner',
    headline: 'PROHIBITION ENDS! TWENTY-FIRST AMENDMENT RATIFIED BY UTAH — THE LAST STATE NEEDED',
    subheadline: 'After 13 Years, 10 Months, and 19 Days, America May Drink Legally Once More',
    body: 'At 5:32 PM Eastern Time on December 5th, Utah became the 36th state to ratify the Twenty-First Amendment to the Constitution, repealing Prohibition. Crowds erupted in cities across the nation. In New York, beer trucks drove up Fifth Avenue to cheers. President Roosevelt signed a proclamation hours later. The great experiment — thirteen years of illicit supply chains, corrupted police forces, and enriched gangsters — is over.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Repeal_of_Prohibition_1933.jpg/320px-Repeal_of_Prohibition_1933.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Twenty-first_Amendment_to_the_United_States_Constitution',
  },
  {
    id: 'news-1933-beer-legal',
    type: 'news', year: 1933, size: 'feature',
    headline: 'BEER FLOWS LEGALLY FOR FIRST TIME SINCE 1920 AS CULLEN-HARRISON ACT TAKES EFFECT',
    subheadline: 'FDR Signs Bill Legalizing 3.2% Beer; President Quips He Could Use a Drink',
    body: 'Low-alcohol beer and wine became legal today under the Cullen-Harrison Act, signed into law by President Roosevelt, who reportedly remarked "I think this would be a good time for a beer." Major breweries that survived Prohibition by producing near-beer, ice cream, and other legal products fired up their vats overnight. Lines stretched around the block at licensed establishments in every major city.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Cullen%E2%80%93Harrison_Act',
  },
  {
    id: 'news-1933-dillinger',
    type: 'news', year: 1933, size: 'brief',
    headline: 'JOHN DILLINGER ESCAPES INDIANA PRISON; FBI DECLARES HIM PUBLIC ENEMY NO. 1',
    body: 'John Dillinger, convicted of bank robbery and sentenced to 10–20 years at Indiana State Prison, has escaped using a wooden pistol he fashioned and blackened with shoe polish. J. Edgar Hoover\'s Bureau of Investigation has declared Dillinger "Public Enemy Number One." With the end of Prohibition defunding many bootleg gangs, bank robbery has emerged as the glamour crime of the new decade.',
    sourceUrl: 'https://en.wikipedia.org/wiki/John_Dillinger',
  },

  // ── OPINION PIECES (any Prohibition era, year = 0 for wild-card) ──────────

  {
    id: 'opinion-dry-noble',
    type: 'opinion', year: 0, size: 'feature',
    headline: 'THE NOBLE EXPERIMENT MUST BE GIVEN TIME TO WORK',
    subheadline: 'By the Editors',
    body: 'Critics of the Eighteenth Amendment are fond of pointing to the speakeasies, the gangsters, and the corrupted policemen as evidence of Prohibition\'s failure. They are wrong to do so. No great moral reform yields its fruit in a single season. The saloon did not fall in a day; neither will the habits it cultivated. Give the law time, fund its enforcement adequately, and the day will come when Americans will look back on the Wet years as a dark chapter mercifully closed.',
  },
  {
    id: 'opinion-wet-futile',
    type: 'opinion', year: 0, size: 'feature',
    headline: 'PROHIBITION HAS GIVEN US CAPONE IN PLACE OF COORS',
    subheadline: 'A Dissenting View from a Man Who Preferred His Bourbon Legal',
    body: 'The Eighteenth Amendment promised us a nation of sober, productive citizens. What it has delivered is a nation of hypocrites, a police force on the take, and a criminal class richer than small nations. Before Prohibition, a man who wished to drink bought his whiskey from a regulated merchant who paid his taxes. Today the same man buys it from a boy with a gun and no discernible address. This is called progress by those who brought it to us.',
  },
  {
    id: 'opinion-women-temperance',
    type: 'opinion', year: 0, size: 'feature',
    headline: 'THE WCTU HAS EARNED ITS VICTORY — NOW COMES THE HARDER WORK',
    subheadline: 'By Mrs. E. M. Whitfield, Chapter President',
    body: 'For forty years the women of the Woman\'s Christian Temperance Union marched, prayed, and petitioned for the amendment that is now the law of the land. Our daughters and granddaughters have inherited a nation where no man may legally ruin his family at a bar counter. But we knew from the beginning that law alone was insufficient. The saloon is gone; its spirit lingers. Education, not merely legislation, must complete what we have begun.',
  },
  {
    id: 'opinion-economics',
    type: 'opinion', year: 0, size: 'feature',
    headline: 'ON THE CURIOUS ECONOMICS OF MAKING A THING ILLEGAL',
    subheadline: 'A Note from a Student of Commerce',
    body: 'A free market will always find a price at which supply meets demand. Prohibition does not extinguish the demand for spirits; it drives that demand underground, raises prices, and substitutes an illegal supply chain for a legal one. The tax revenues that once funded schools and roads now fund the wardrobes of bootleggers. The government has not abolished the liquor trade; it has merely changed its management.',
  },
  {
    id: 'opinion-rural-dry',
    type: 'opinion', year: 0, size: 'brief',
    headline: 'THE CITY HAS NO RIGHT TO DEMAND THAT THE COUNTRY SHARE ITS VICES',
    body: 'The repeal movement is a movement of the cities — of immigrants, of Catholics, of men who have never known the wreckage that drink leaves in a farming community. Let the Wets of New York and Chicago speak for themselves. The dry counties of the South and Middle West are not laboratories for other men\'s social experiments.',
  },
  {
    id: 'opinion-enforcement',
    type: 'opinion', year: 0, size: 'brief',
    headline: 'A PROHIBITION AGENT CONFESSES: WE CANNOT WIN THIS WAR',
    body: 'I have served four years in the Prohibition Bureau and I tell you plainly what my superiors refuse to admit in public: we are outnumbered, outspent, and outgunned. For every still we destroy, three more open. The men who bribe us earn in a month what we earn in a year. We are not failing for lack of virtue; we are failing for lack of arithmetic.',
  },
  {
    id: 'opinion-cocktail-culture',
    type: 'opinion', year: 0, size: 'brief',
    headline: 'PROHIBITION HAS PRODUCED THE FINEST COCKTAILS IN THE NATION\'S HISTORY',
    body: 'There is one undeniable benefit of Prohibition that the temperance press declines to mention: the quality of mixed drinks available in the better New York speakeasies is without precedent. When the spirit itself is often barely palatable, the mixologist is forced to innovate. The gin martini, the sidecar, and the bee\'s knees are all gifts of this supposedly dry era.',
  },
  {
    id: 'opinion-canada',
    type: 'opinion', year: 0, size: 'brief',
    headline: 'OUR FRIENDS IN CANADA THANK US FOR OUR CONTINUED CUSTOM',
    body: 'The Dominion of Canada did not impose Prohibition upon itself, and it has prospered accordingly. The Seagram and Hiram Walker distilleries operate at full capacity, their products destined largely for American shores. The Canadian government collects the excise taxes; the American government collects the bodies. Some would call this arrangement a triumph of federalism.',
  },
  {
    id: 'opinion-jazzsinger',
    type: 'opinion', year: 0, size: 'brief',
    headline: 'JAZZ MUSIC AND BOOTLEG WHISKEY: PRODUCTS OF THE SAME CORRUPT SOIL',
    body: 'The Anti-Vice Society of Greater Detroit wishes it to be known that the spread of so-called "jazz" music through our city\'s speakeasies is not unrelated to the spread of illicit spirits. Both are products of the same moral degradation, the same willful casting-off of Christian restraint. Young men and women who frequent these establishments are imperiling not only their bodies but their souls.',
  },
  {
    id: 'opinion-repealist',
    type: 'opinion', year: 0, size: 'feature',
    headline: 'THE CASE FOR REPEAL: THIRTEEN REASONS IN THIRTEEN YEARS',
    body: 'The Wet argument can be stated simply: Prohibition was promised to reduce crime, poverty, and intemperance. It has increased all three while adding corruption on a scale previously unimagined in American public life. The law that cannot be enforced is worse than no law at all, for it breeds contempt for all laws. The Eighteenth Amendment should be repealed, the liquor trade regulated and taxed, and the revenue directed to the social improvements that Prohibition promised and failed to deliver.',
  },

  // ── ADVERTISEMENTS ────────────────────────────────────────────────────────

  {
    id: 'ad-grape-brick',
    type: 'ad', year: 0, size: 'brief',
    headline: 'VINE-GLO — THE GRAPE CONCENTRATE OF DISTINCTION',
    body: 'From California\'s finest vineyards! Dissolve one brick in one gallon of water. Your "juice" will be ready in 60 days. NOTE: Do not place in warm location — fermentation may result, which would be ILLEGAL under Federal law. Available in Port, Virginia Dare, Burgundy, Claret, Tokay. $1.50 per brick. CALIFORNIA VINEYARDISTS ASSOCIATION, Los Angeles.',
  },
  {
    id: 'ad-near-beer',
    type: 'ad', year: 0, size: 'brief',
    headline: 'BEVO — THE ALL-YEAR-ROUND BEVERAGE',
    body: 'Anheuser-Busch\'s famous BEVO contains less than one-half of one percent alcohol — perfectly legal and perfectly refreshing. The same quality grain, the same Budweiser yeast, the same careful brewing. Available at all respectable grocers and drug stores. "The beverage that satisfies." ANHEUSER-BUSCH, St. Louis, Missouri.',
  },
  {
    id: 'ad-sears-radio',
    type: 'ad', year: 0, size: 'brief',
    headline: 'SILVERTONE RADIO RECEIVERS — HEAR THE WORLD FROM YOUR PARLOR',
    body: 'The new SILVERTONE Model 6 brings you crystal-clear reception from stations as far as 500 miles distant. No aerial required. Complete with tubes, batteries, and headphones. $24.95 at your Sears, Roebuck & Company catalogue or store. SEARS, ROEBUCK & COMPANY, Chicago, Illinois.',
  },
  {
    id: 'ad-ford-model-t',
    type: 'ad', year: 0, size: 'brief',
    headline: 'THE FORD — A DEPENDABLE COMPANION FOR EVERY ROAD',
    body: 'No machine in the world has served more American families, farmers, and tradesmen than the Ford Motor Car. Built tough, maintained easily, priced within every working man\'s reach. The Ford is available at your nearest dealer. Prices start at $290. FORD MOTOR COMPANY, Dearborn, Michigan.',
  },
  {
    id: 'ad-wrigleys',
    type: 'ad', year: 0, size: 'brief',
    headline: 'WRIGLEY\'S SPEARMINT — AFTER EVERY MEAL',
    body: 'Dentists recommend it. Millions enjoy it. WRIGLEY\'S SPEARMINT GUM freshens breath, aids digestion, and satisfies the desire for something sweet without the dangers of strong drink. Five sticks for five cents. WRIGLEY COMPANY, Chicago.',
  },
  {
    id: 'ad-coca-cola',
    type: 'ad', year: 0, size: 'brief',
    headline: 'THE PAUSE THAT REFRESHES',
    body: 'When thirst calls — and it will — answer it with ice-cold COCA-COLA. Delicious, invigorating, and always wholesome. Available at every soda fountain and drug store across America. Five cents. THE COCA-COLA COMPANY, Atlanta, Georgia.',
  },
  {
    id: 'ad-malt-extract',
    type: 'ad', year: 0, size: 'brief',
    headline: 'PURITAN MALT EXTRACT — FOR BAKING AND HOME COOKING',
    body: 'PURITAN Malt Extract is the indispensable pantry staple for bread-making, cakes, and wholesome home cooking. Rich in vitamins. One pound tins, $0.35. NOTE FROM MANUFACTURER: Customers should be aware that PURITAN Malt Extract is strictly a cooking ingredient. Any accidental fermentation resulting from improper storage is the responsibility of the purchaser. PURITAN PRODUCTS, Milwaukee.',
  },
  {
    id: 'ad-packard',
    type: 'ad', year: 0, size: 'brief',
    headline: 'ASK THE MAN WHO OWNS ONE',
    body: 'The PACKARD Motor Car requires no advertisement beyond its owner\'s satisfaction. Smooth, powerful, and built with a craftsman\'s care. The choice of presidents, industrialists, and men of discernment everywhere. PACKARD MOTOR CAR COMPANY, Detroit, Michigan. Prices upon application.',
  },
  {
    id: 'ad-dr-pepper',
    type: 'ad', year: 0, size: 'brief',
    headline: 'DRINK A BITE TO EAT AT 10, 2, AND 4 O\'CLOCK',
    body: 'DR PEPPER, the friendly Pepper-Upper! Three times daily, millions of Americans enjoy the unique, refreshing taste that can\'t be described — only experienced. Sold at fountains everywhere. THE DR PEPPER COMPANY, Dallas, Texas.',
  },
  {
    id: 'ad-victrola',
    type: 'ad', year: 0, size: 'brief',
    headline: 'THE VICTOR VICTROLA BRINGS THE CONCERT HALL HOME',
    body: 'Why go out for entertainment when Caruso, Sousa, and all the great artists of the age will perform for you in your own parlor? The new VICTOR VICTROLA with orthophonic sound reproduction faithfully captures every note. Models from $25. RCA VICTOR, Camden, New Jersey.',
  },
  {
    id: 'ad-lucky-strike',
    type: 'ad', year: 0, size: 'brief',
    headline: 'REACH FOR A LUCKY INSTEAD OF A SWEET',
    body: 'Modern science has determined that LUCKY STRIKE cigarettes are endorsed by 20,679 physicians for their throat-protecting toasted tobacco. "It\'s Toasted" — that\'s the Lucky Strike difference. When temptation calls, reach for a Lucky. AMERICAN TOBACCO COMPANY.',
  },
  {
    id: 'ad-patent-medicine',
    type: 'ad', year: 0, size: 'brief',
    headline: 'DR. HINKLEY\'S CELEBRATED SOOTHING TONIC — PRESCRIBED FOR WHAT AILS YOU',
    body: 'For nervous complaints, ladies\' troubles, dyspepsia, and general debility, nothing equals DR. HINKLEY\'S CELEBRATED SOOTHING TONIC. Contains 14% grain spirits (for medicinal purposes only, pursuant to valid prescription). Available at authorized dispensaries. $1.00 per bottle. HINKLEY PHARMACEUTICAL, Cincinnati, Ohio.',
  },

  // ── WILD-CARD STORIES (year = 0, shown any time) ─────────────────────────

  {
    id: 'wildcard-moonshiners',
    type: 'news', year: 0, size: 'feature',
    headline: 'APPALACHIAN MOONSHINERS SUPPLY NORTHERN CITIES WITH UNTAXED SPIRITS',
    body: 'Revenue agents operating in the hills of Kentucky, Tennessee, and West Virginia report a thriving trade in illegally produced corn whiskey flowing northward to supply the speakeasies of Cincinnati, Pittsburgh, and New York. Mountain distillers, many of whom were producing whiskey for personal use long before Prohibition, have found a ready urban market. Some operations have grown to industrial scale, employing dozens and producing hundreds of gallons weekly.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Moonshine_still.jpg/320px-Moonshine_still.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Moonshine',
  },
  {
    id: 'wildcard-woman-bootlegger',
    type: 'news', year: 0, size: 'feature',
    headline: 'AUTHORITIES REPORT WOMEN INCREASINGLY ACTIVE IN BOOTLEG TRADE',
    body: 'Federal Prohibition agents in several cities report an unexpected trend: women are increasingly active participants in the bootleg trade, both as operators of speakeasies and as distributors of illicit spirits. Agents note that female smugglers present particular difficulties, as the law restricts pat-down searches by male officers. One Chicago operative known as "The Duchess" is believed to have run a distribution network serving forty establishments on the North Side.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Prohibition_in_the_United_States',
  },
  {
    id: 'wildcard-bathtub-gin',
    type: 'news', year: 0, size: 'brief',
    headline: 'HEALTH BOARD WARNS OF DANGERS FROM IMPROPERLY MADE SPIRITS',
    body: 'The city Board of Health has issued an urgent warning against consuming homemade spirits of uncertain origin following six hospitalizations from methanol poisoning in the past week. Illicit gin produced from industrial alcohol stripped of its denaturants is particularly dangerous, the Board notes, as the process is imperfectly executed in most home operations. The Board urges citizens to abstain entirely — or at minimum, to know their distiller personally.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Bathtub_gin',
  },
  {
    id: 'wildcard-tunnel',
    type: 'news', year: 0, size: 'brief',
    headline: 'AGENTS DISCOVER 200-FOOT TUNNEL CONNECTING GARAGE TO SPEAKEASY',
    body: 'Prohibition agents raiding a garage on the West Side discovered a 200-foot tunnel lined with electric lights and equipped with a small hand-operated rail car for transporting cases of whiskey. The tunnel connected to the basement of a "soda parlor" three blocks away that had been in operation for two years. The owner of the soda parlor expressed complete surprise at the discovery.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Speakeasy',
  },
  {
    id: 'wildcard-ships',
    type: 'news', year: 0, size: 'brief',
    headline: 'BOOTLEG YACHT "EVENING STAR" OUTPACES COAST GUARD IN THREE-HOUR CHASE',
    body: 'The rumrunner Evening Star, believed to be carrying 800 cases of Canadian rye whiskey, eluded three Coast Guard cutters in a three-hour chase off the Jersey Shore before disappearing into a fog bank. The Evening Star, reportedly powered by a converted Liberty aircraft engine, is estimated to be capable of 42 knots. The Coast Guard is requesting an emergency appropriation for faster vessels.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Rum_Row',
  },
  {
    id: 'wildcard-npc-police',
    type: 'news', year: 0, size: 'brief',
    headline: 'GRAND JURY INDICTS EIGHT OFFICERS FOR ACCEPTING BOOTLEGGER BRIBES',
    body: 'A county grand jury has returned indictments against eight police officers for allegedly accepting monthly payments from bootlegging interests in exchange for advance notice of raids and protection from arrest. The district attorney\'s office said the investigation is continuing and that more indictments are expected. The police commissioner called the officers "a disgrace to the badge" while declining to comment on the investigation.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Prohibition_in_the_United_States',
  },
  {
    id: 'wildcard-supply-chain',
    type: 'news', year: 0, size: 'feature',
    headline: 'FROM STILL TO GLASS: THE REMARKABLE LOGISTICS OF ILLICIT SPIRITS',
    body: 'A bottle of whiskey purchased at a typical Chicago speakeasy may have begun its journey as grain in a Kentucky field, been distilled in a West Virginia hollow, transported by truck to Cincinnati, cut and bottled in a Detroit warehouse, moved across state lines hidden in crates of canned goods, and finally delivered to a North Side speakeasy in a dry-cleaning van. Each hand it passed through took a cut; by the time it reached the customer, a bottle that cost fifty cents to produce sold for three dollars. The markup, observers note, reflects the considerable overhead of staying out of prison.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Prohibition_in_the_United_States',
  },
  {
    id: 'wildcard-canada',
    type: 'news', year: 0, size: 'brief',
    headline: 'WINDSOR ONTARIO REPORTS EXPORT OF 900,000 GALLONS OF SPIRITS IN ONE MONTH',
    body: 'Customs records in Windsor, Ontario show that 900,000 gallons of spirits were legally exported from that city in a single month, ostensibly bound for Cuba and other international destinations. Investigators have noted that Cuba\'s annual legal spirits consumption is approximately 50,000 gallons. The discrepancy, one agent observed, could be explained by very thirsty Cubans or by the proximity of Detroit.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Rum-running',
  },
  {
    id: 'wildcard-jazz-club',
    type: 'news', year: 0, size: 'brief',
    headline: 'HARLEM COTTON CLUB PACKS 700 NIGHTLY; ELLINGTON ORCHESTRA THE DRAW',
    body: 'The Cotton Club on Lenox Avenue, operated under arrangements that have not been explained to the satisfaction of reformers, draws 700 customers nightly to hear Duke Ellington\'s orchestra play until dawn. The club serves no alcohol according to its management. Patrons arrive sober and depart, based on extensive observation, in a condition inconsistent with that claim.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Cotton_Club',
  },
  {
    id: 'wildcard-funny',
    type: 'news', year: 0, size: 'brief',
    headline: 'JUDGE FINES HIMSELF $10 AFTER ADMITTING HE DRANK BEER WHILE PRESIDING',
    body: 'Judge William Clark of the municipal court drew laughter and applause when he announced from the bench that, having consumed a glass of beer at a dinner party the previous evening, he was obliged to fine himself $10 under the very statute he was there to enforce. He paid the fine from his own pocket, thanked the court for its forbearance, and resumed hearing cases.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Prohibition_in_the_United_States',
  },
]

/**
 * Get stories matching a given in-game year (±1 year window).
 * Wild-card stories (year = 0) are always included in the pool.
 * If fewer than minCount era-matched stories exist, expands to ±2 years.
 */
export function getStoriesForYear(
  year: number,
  types?: StoryType[],
  minCount = 3
): ProhibitionStory[] {
  const filter = (window: number) =>
    PROHIBITION_STORIES.filter(s =>
      (s.year === 0 || Math.abs(s.year - year) <= window) &&
      (!types || types.includes(s.type))
    )

  const narrow = filter(1)
  return narrow.length >= minCount ? narrow : filter(2)
}

/**
 * Convert system game messages to newspaper brief stories.
 * Parses emoji-prefixed patterns from the existing messages system.
 */
export interface GameMessage {
  id: number
  message: string
  isSystem: boolean
  createdAt: string
}

export function extractGameHeadlines(
  messages: GameMessage[],
  currentSeason: number
): ProhibitionStory[] {
  const year = 1920 + Math.floor((currentSeason - 1) / 4)
  const seen = new Set<string>()
  const results: ProhibitionStory[] = []

  for (const msg of messages) {
    if (!msg.isSystem) continue
    const text = msg.message

    let headline: string | null = null
    let key: string | null = null

    if ((text.includes('🥃') || text.includes('raided')) && text.toLowerCase().includes('still')) {
      // Extract city name from "... in [City]" pattern
      const cityMatch = text.match(/in\s+([A-Z][a-zA-Z\s]+?)(?:\.|,|$)/)
      const city = cityMatch ? cityMatch[1].trim() : 'the area'
      key = `raid-${city}`
      headline = `AGENTS SMASH STILL IN ${city.toUpperCase()} — HOOCH CONFISCATED`
    } else if (text.toLowerCase().includes('jail') || text.toLowerCase().includes('arrested')) {
      const nameMatch = text.match(/^([A-Za-z@.\s]+?)\s+(?:was|has been|is)/)
      const name = nameMatch ? nameMatch[1].trim() : 'Local Bootlegger'
      key = `arrest-${name}`
      headline = `${name.toUpperCase()} NABBED BY FEDS — SENTENCED TO THE HOOSEGOW`
    } else if (text.toLowerCase().includes('claimed') || text.toLowerCase().includes('took over') || text.toLowerCase().includes('territory')) {
      const cityMatch = text.match(/(?:claimed|took over|controls?)\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|$)/)
      const city = cityMatch ? cityMatch[1].trim() : 'a City'
      key = `claim-${city}`
      headline = `${city.toUpperCase()} TERRITORY CHANGES HANDS IN BOLD POWER PLAY`
    } else if (text.includes('💰') && text.toLowerCase().includes('toll')) {
      const cityMatch = text.match(/(?:through|in)\s+([A-Z][a-zA-Z\s]+?)(?:\.|,|$)/)
      const city = cityMatch ? cityMatch[1].trim() : 'the City'
      key = `toll-${city}`
      headline = `${city.toUpperCase()} TOLL ROADS ENRICHING CITY BOSSES`
    }

    if (headline && key && !seen.has(key)) {
      seen.add(key)
      results.push({
        id: `game-event-${msg.id}`,
        type: 'news',
        year,
        size: 'brief',
        headline,
        body: msg.message.replace(/[🥃💰🏙️💀⚠️🪤]/gu, '').trim(),
      })
    }
  }

  return results
}
