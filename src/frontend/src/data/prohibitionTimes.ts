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
  publishedDate?: string // e.g. "January 17, 1920" — actual or best-guess publication date
  author?: string        // For opinion pieces — display name and title
  authorImageUrl?: string // Portrait of the author
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
    publishedDate: 'January 17, 1920',
    body: 'The National Prohibition Act, shepherded through Congress by Rep. Andrew Volstead of Minnesota, has taken full effect across the United States. Sale, manufacture, and transportation of intoxicating liquors are henceforth illegal. Authorities promise strict enforcement, though critics warn the law will prove unenforceable in the nation\'s great cities.',
    imageUrl: '/newspaper/volstead_act.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Volstead_Act',
  },
  {
    id: 'news-1920-rum-row',
    type: 'news', year: 1920, size: 'feature',
    headline: 'SHIPS LADEN WITH LIQUOR ANCHOR JUST BEYOND TERRITORIAL LIMIT',
    subheadline: '"Rum Row" Defies Coast Guard off New York Harbor',
    publishedDate: 'April 3, 1920',
    body: 'A fleet of vessels carrying foreign spirits has taken anchor three miles offshore, just beyond the reach of federal law. Small, fast motorboats make nightly runs to shore, outpacing the Revenue Cutter Service with alarming ease. Treasury officials are calling for expanded naval patrols, while New York barkeeps quietly report no shortage of supply.',
    imageUrl: '/newspaper/rum_row_ship.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Rum_Row',
  },
  {
    id: 'news-1920-izzy',
    type: 'news', year: 1920, size: 'feature',
    headline: 'FEDERAL AGENT IZZY EINSTEIN BAGS 65 BOOTLEGGERS IN FIRST MONTH',
    subheadline: 'Portly Prohibition Agent Uses Disguises to Catch Violators Off Guard',
    publishedDate: 'February 14, 1920',
    body: 'Isidor "Izzy" Einstein, a former postal clerk turned Prohibition agent, has become the terror of New York\'s underground liquor trade. Disguised variously as a fisherman, a football player, and a Talmudic scholar, Einstein has secured 65 arrests in his first thirty days on the job. "The thirst for justice," he told reporters, "is greater than the thirst for gin."',
    imageUrl: '/newspaper/izzy_einstein.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Izzy_and_Moe',
  },

  // ── 1921 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1921-chicago-gangs',
    type: 'news', year: 1921, size: 'banner',
    headline: 'CHICAGO GANG WARS LEAVE THREE DEAD ON WABASH AVENUE',
    subheadline: 'South Side and North Side Factions Contest Control of Lucrative Hooch Routes',
    publishedDate: 'April 6, 1921',
    body: 'Violence erupted on Wabash Avenue late Tuesday when gunmen affiliated with the South Side liquor syndicate ambushed a delivery convoy crossing into rival territory. Three men were killed and two wounded in an exchange described by witnesses as a "regular battle." Police arrived to find only shell casings and a shattered delivery truck. No arrests have been made.',
    imageUrl: '/newspaper/prohibition_disposal.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Chicago_Outfit',
  },
  {
    id: 'news-1921-grape-bricks',
    type: 'news', year: 1921, size: 'feature',
    headline: 'GRAPE GROWERS REPORT RECORD SALES AS HOME WINEMAKING BOOMS',
    subheadline: 'Volstead Act Permits Head-of-Household to Produce 200 Gallons Annually',
    publishedDate: 'September 18, 1921',
    body: 'California grape growers are shipping record tonnage eastward as Americans take advantage of a little-noticed provision in the Volstead Act permitting households to produce up to 200 gallons of "non-intoxicating cider and fruit juices" per year. Enterprising vintners now sell "Vine-Glo" concentrate blocks with labels warning: "After dissolving in water, do not place in a warm location for twenty days, as this will cause fermentation."',
    imageUrl: '/newspaper/vine_glo_brick.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Vine-Glo',
  },
  {
    id: 'news-1921-speakeasy',
    type: 'news', year: 1921, size: 'brief',
    headline: 'SPEAKEASY COUNT IN MANHATTAN ESTIMATED AT 5,000 AND RISING',
    publishedDate: 'June 30, 1921',
    body: 'A survey commissioned by the Anti-Saloon League estimates that no fewer than 5,000 illicit drinking establishments now operate in Manhattan alone — more than double the number of legal saloons before Prohibition. "The law is being openly flouted," the League\'s report admits, "in every ward of the city."',
    imageUrl: '/newspaper/speakeasy_interior.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Speakeasy',
  },

  // ── 1922 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1922-torrio',
    type: 'news', year: 1922, size: 'banner',
    headline: 'TORRIO SYNDICATE CONTROLS BOOTLEG SUPPLY TO FOUR COUNTIES',
    subheadline: 'Former New York Operator Builds Chicago Empire from Capone\'s Back Office',
    publishedDate: 'February 11, 1922',
    body: 'Johnny Torrio, a mild-mannered Brooklynite who prefers negotiation to violence, has quietly consolidated control over the bootleg supply to Cook, DuPage, Kane, and Lake counties in Illinois. Operating out of the Four Deuces on South Wabash, Torrio employs hundreds and grosses an estimated $4 million annually. His lieutenant, a young man named Alphonse Capone, handles day-to-day enforcement.',
    imageUrl: '/newspaper/johnny_torrio.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Johnny_Torrio',
  },
  {
    id: 'news-1922-coast-guard',
    type: 'news', year: 1922, size: 'feature',
    headline: 'COAST GUARD SEIZES RECORD 12,000 CASES OF SCOTCH WHISKY OFF JERSEY SHORE',
    publishedDate: 'July 19, 1922',
    body: 'Revenue agents intercepted the schooner *Tomoka* early Thursday morning, finding her hold packed with 12,000 cases of Scotch whisky bound for New York buyers. The haul is the largest single seizure since the Volstead Act took effect. The vessel\'s captain claimed he was carrying molasses from the Bahamas; agents noted that molasses seldom travels in labeled bottles.',
    sourceUrl: 'https://en.wikipedia.org/wiki/United_States_Coast_Guard_and_Prohibition',
  },
  {
    id: 'news-1922-industrial',
    type: 'news', year: 1922, size: 'brief',
    headline: 'GOVERNMENT ORDERS INDUSTRIAL ALCOHOL ADULTERATED WITH POISON TO DETER THEFT',
    publishedDate: 'March 28, 1922',
    body: 'The Treasury Department has quietly mandated that industrial alcohol — legally available for manufacturing purposes — be "denatured" with methanol, benzene, and other toxic agents to deter diversion into the bootleg supply. Critics warn that unscrupulous operators will redistill the tainted spirit regardless, putting drinkers at grave risk.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Chemist%27s_war',
  },

  // ── 1923 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1923-harding',
    type: 'news', year: 1923, size: 'banner',
    headline: 'PRESIDENT HARDING DEAD AT 57; COOLIDGE TAKES OATH',
    subheadline: 'Teapot Dome Scandals Cloud Legacy of 29th President',
    publishedDate: 'August 3, 1923',
    body: 'President Warren G. Harding died suddenly in San Francisco on August 2nd, shocking the nation. Vice President Calvin Coolidge, vacationing at his Vermont farm, was sworn in by his father, a notary public, by lamplight. Harding\'s sudden death has forestalled a congressional investigation into corruption at the Interior Department, though critics vow to press forward.',
    imageUrl: '/newspaper/warren_harding.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Warren_G._Harding',
  },
  {
    id: 'news-1923-izzy-fired',
    type: 'news', year: 1923, size: 'feature',
    headline: 'PROHIBITION BUREAU DISMISSES EINSTEIN AND MOE — TOO MUCH PUBLICITY',
    publishedDate: 'November 13, 1923',
    body: 'Isidor Einstein and his partner Moe Smith, the most celebrated Prohibition agents in the country, have been dismissed by the Bureau of Prohibition. Officials cited "too much publicity" as the grounds for termination. In four years of service the pair made 4,932 arrests and confiscated five million bottles of liquor; their sacking was greeted with dismay by the temperance press and barely concealed glee by New York\'s thirsty population.',
    imageUrl: '/newspaper/izzy_einstein.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Izzy_and_Moe',
  },
  {
    id: 'news-1923-medicinal',
    type: 'news', year: 1923, size: 'brief',
    headline: 'DOCTORS WRITE 11 MILLION WHISKEY PRESCRIPTIONS IN CALENDAR YEAR',
    publishedDate: 'April 9, 1923',
    body: 'The American Medical Association reports that physicians wrote approximately 11 million prescriptions for "medicinal whiskey" in 1922, generating $40 million in fees. Walgreen\'s drugstore chain has expanded from 20 locations to over 200 since Prohibition began, fueled largely by its pharmaceutical spirits business.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Medicinal_use_of_alcohol_during_Prohibition',
  },

  // ── 1924 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1924-capone-rise',
    type: 'news', year: 1924, size: 'banner',
    headline: 'AL CAPONE ASSUMES COMMAND OF CHICAGO OUTFIT AFTER TORRIO SHOOTING',
    subheadline: 'Torrio Survives Assassination Attempt; Retires to Italy',
    publishedDate: 'January 17, 1924',
    body: 'Johnny Torrio, wounded in a brazen daylight shooting outside his home on Clyde Avenue, has handed control of Chicago\'s vast bootleg empire to his twenty-five year old lieutenant, Alphonse Capone. Torrio told associates he is "through with the rackets" and has booked passage to Italy. Capone, who prefers to be called "Scarface" by no one, is expected to run the operation with considerably less subtlety than his predecessor.',
    imageUrl: '/newspaper/al_capone.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Al_Capone',
  },
  {
    id: 'news-1924-deanie-obanion',
    type: 'news', year: 1924, size: 'feature',
    headline: 'FLORIST AND NORTH SIDE GANG BOSS DION O\'BANION SHOT DEAD IN HIS SHOP',
    subheadline: 'Three Gunmen Enter Schofield\'s Flower Shop; Proprietor Dies Clutching Chrysanthemums',
    publishedDate: 'November 11, 1924',
    body: 'Dean O\'Banion, florist and leader of the North Side Gang, was shot dead in his flower shop on North State Street yesterday afternoon. Three men entered on the pretext of purchasing flowers for a funeral; one shook O\'Banion\'s hand and held it while the others fired six shots. Chicago police profess themselves baffled.',
    imageUrl: '/newspaper/dean_obanion.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Dean_O%27Banion',
  },
  {
    id: 'news-1924-border-patrol',
    type: 'news', year: 1924, size: 'brief',
    headline: 'BORDER PATROL ESTABLISHED TO STEM FLOOD OF CANADIAN WHISKY',
    publishedDate: 'May 29, 1924',
    body: 'Congress has established the United States Border Patrol to guard the nation\'s land frontiers. Lawmakers specifically cited the unimpeded flow of Canadian whisky across the northern border as a primary motivation. Agents in Detroit report that bootleggers are using underwater pipelines, fake fishing boats, and in winter, automobiles driven across the frozen Detroit River.',
    sourceUrl: 'https://en.wikipedia.org/wiki/United_States_Border_Patrol',
  },

  // ── 1925 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1925-scopes',
    type: 'news', year: 1925, size: 'banner',
    headline: 'SCOPES "MONKEY TRIAL" GRIPS NATION AS TENNESSEE TEACHER STANDS ACCUSED',
    subheadline: 'Darrow Squares Off Against Bryan in Dayton Courtroom; Nation Divided',
    publishedDate: 'July 11, 1925',
    body: 'John T. Scopes, a high school biology teacher in Dayton, Tennessee, has gone on trial for violating the Butler Act, which prohibits the teaching of evolutionary theory in public schools. Clarence Darrow leads the defense; William Jennings Bryan, three-time presidential candidate and champion of temperance, argues for the prosecution. H. L. Mencken reports daily from Dayton in characteristically uncharitable terms.',
    imageUrl: '/newspaper/john_scopes.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Scopes_Trial',
  },
  {
    id: 'news-1925-capone-cicero',
    type: 'news', year: 1925, size: 'feature',
    headline: 'CAPONE MOVES HEADQUARTERS TO CICERO; CONTROLS ENTIRE SUBURB',
    publishedDate: 'March 28, 1925',
    body: 'Al Capone has relocated his criminal headquarters to the Hotel Hawthorne in Cicero, Illinois, a move observers attribute to increasing heat from Chicago\'s new reform mayor. Capone now controls every speakeasy, gambling den, and brothel in Cicero and reportedly receives tribute from the town\'s elected officials. A revenue agent who visited the Hawthorne described it as "the best-run hotel in the western suburbs."',
    imageUrl: '/newspaper/al_capone.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Al_Capone',
  },
  {
    id: 'news-1925-great-gatsby',
    type: 'news', year: 1925, size: 'brief',
    headline: 'NEW NOVEL BY FITZGERALD DEPICTS BOOTLEGGER AS ROMANTIC HERO',
    publishedDate: 'April 11, 1925',
    body: 'F. Scott Fitzgerald\'s new novel "The Great Gatsby" has been published to mixed reviews but brisk sales. The book centers on a mysterious Long Island millionaire of uncertain fortune who throws lavish parties and is rumored to be connected to "drug stores" — a common euphemism for bootleg operations. Literary critics differ on whether Fitzgerald romanticizes or condemns his subject.',
    sourceUrl: 'https://en.wikipedia.org/wiki/The_Great_Gatsby',
  },

  // ── 1926 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1926-hymie-weiss',
    type: 'news', year: 1926, size: 'banner',
    headline: 'NORTH SIDE CHIEF HYMIE WEISS MACHINE-GUNNED OUTSIDE HOLY NAME CATHEDRAL',
    subheadline: 'Chicago Gang War Claims Ninth Leader in Eighteen Months',
    publishedDate: 'October 12, 1926',
    body: 'Earl "Hymie" Weiss, leader of the North Side Gang and sworn enemy of Al Capone, was shot down by machine gun fire outside Holy Name Cathedral on North State Street yesterday. The killing is the ninth assassination of a major gang figure in Chicago in the past eighteen months. Police superintendent Morgan Collins called the situation "a disgrace" and promised action; bookmakers in the Loop were offering even odds on how long Collins himself would last in the job.',
    imageUrl: '/newspaper/hymie_weiss.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Hymie_Weiss',
  },
  {
    id: 'news-1926-coast-guard-rum',
    type: 'news', year: 1926, size: 'feature',
    headline: 'COAST GUARD ACQUIRES FLEET OF FAST CUTTERS TO COMBAT RUM RUNNING',
    publishedDate: 'June 5, 1926',
    body: 'The Treasury Department has completed delivery of twenty new high-speed patrol cutters capable of exceeding thirty knots, specifically designed to run down the fast rumrunners operating off the Eastern Seaboard. Bootleggers have responded by acquiring converted Liberty engines capable of even greater speeds. Marine engineers on both sides of the law report a brisk business in engine upgrades.',
    imageUrl: '/newspaper/coast_guard_mojave.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/United_States_Coast_Guard_and_Prohibition',
  },
  {
    id: 'news-1926-corruption',
    type: 'news', year: 1926, size: 'brief',
    headline: 'SENATE COMMITTEE HEARS TESTIMONY THAT HALF OF CHICAGO POLICE ON BOOTLEGGER PAYROLL',
    publishedDate: 'February 24, 1926',
    body: 'Testimony before the Senate Prohibition Investigation Committee suggests that upwards of half of Chicago\'s 6,000-man police force receives regular payments from bootlegging interests. A former precinct captain testified that the going rate for protection of a single speakeasy was $75 per month, with larger establishments paying proportionally more.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Prohibition_in_the_United_States',
  },

  // ── 1927 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1927-lindbergh',
    type: 'news', year: 1927, size: 'banner',
    headline: 'LINDBERGH CROSSES ATLANTIC SOLO IN 33½ HOURS — PARIS GOES MAD WITH JOY',
    subheadline: 'Young Mail Pilot in Spirit of St. Louis Completes First Nonstop New York–Paris Flight',
    publishedDate: 'May 22, 1927',
    body: 'Charles A. Lindbergh, a 25-year-old airmail pilot from Minnesota, landed his monoplane Spirit of St. Louis at Le Bourget Field outside Paris at 10:22 PM local time, completing the first solo nonstop transatlantic flight in history. An estimated 100,000 Parisians stormed the airfield. President Coolidge dispatched a naval cruiser to bring the hero home. The flight has been universally acclaimed as proof that America\'s spirit is undiminished.',
    imageUrl: '/newspaper/lindbergh_spirit.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Transatlantic_flight_of_Charles_Lindbergh',
  },
  {
    id: 'news-1927-purple-gang',
    type: 'news', year: 1927, size: 'feature',
    headline: 'DETROIT\'S PURPLE GANG EXTENDS BOOTLEG REACH TO FIVE STATES',
    publishedDate: 'September 4, 1927',
    body: 'The Purple Gang, a Detroit-based syndicate that controls the bulk of Canadian whisky flowing across the Detroit River, has expanded its distribution network to Ohio, Indiana, Pennsylvania, and Michigan, according to federal investigators. The gang is known for its willingness to murder rivals without negotiation. Al Capone, who attempted to muscle in on their territory, reportedly sent a diplomatic delegation instead after three of his men failed to return.',
    imageUrl: '/newspaper/purple_gang.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Purple_Gang',
  },
  {
    id: 'news-1927-sacco-vanzetti',
    type: 'news', year: 1927, size: 'brief',
    headline: 'SACCO AND VANZETTI EXECUTED AFTER SIX YEARS OF CONTROVERSY',
    publishedDate: 'August 24, 1927',
    body: 'Nicola Sacco and Bartolomeo Vanzetti, Italian immigrants convicted of murder in a controversial 1921 trial, were executed in the electric chair at Charlestown State Prison early this morning. Protests erupted in Paris, London, and Buenos Aires; in Boston, National Guardsmen with fixed bayonets kept crowds from the prison gates. Governor Fuller declined to grant clemency.',
    imageUrl: '/newspaper/sacco_vanzetti.png',
    sourceUrl: 'https://en.wikipedia.org/wiki/Sacco_and_Vanzetti',
  },

  // ── 1928 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1928-hoover',
    type: 'news', year: 1928, size: 'banner',
    headline: 'HOOVER ELECTED IN LANDSLIDE; VOWS STRICTER ENFORCEMENT OF PROHIBITION',
    subheadline: 'Commerce Secretary Defeats Al Smith; First Catholic Presidential Candidate Carries Only 8 States',
    publishedDate: 'November 7, 1928',
    body: 'Herbert Hoover has won the presidency in a decisive victory over New York Governor Al Smith, carrying 40 states and 444 electoral votes. Hoover, who called Prohibition "a great social and economic experiment, noble in motive," promised rigorous enforcement and a reorganization of the corrupted Prohibition Bureau. Smith\'s Catholicism and his outspoken opposition to Prohibition were widely cited as factors in his defeat.',
    imageUrl: '/newspaper/herbert_hoover.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/1928_United_States_presidential_election',
  },
  {
    id: 'news-1928-machines',
    type: 'news', year: 1928, size: 'feature',
    headline: 'THOMPSON SUB-MACHINE GUN BECOMES WEAPON OF CHOICE IN GANG WARS',
    publishedDate: 'March 15, 1928',
    body: 'The Thompson sub-machine gun, developed during the war as a "trench broom" and subsequently a commercial failure, has found a lucrative second market among bootlegging syndicates. The weapon, capable of firing 800 rounds per minute, is responsible for an estimated 40 percent of gang-related homicides in Chicago and Detroit. Its manufacturer, Auto-Ordnance Corporation, sold the weapons legally to any buyer for $200 apiece until recently tightening sales policies.',
    imageUrl: '/newspaper/thompson_m1928.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Thompson_submachine_gun',
  },
  {
    id: 'news-1928-bugs-moran',
    type: 'news', year: 1928, size: 'brief',
    headline: 'BUGS MORAN SWEARS REVENGE AFTER CAPONE HIJACKS NORTH SIDE WHISKY CONVOY',
    publishedDate: 'July 28, 1928',
    body: 'George "Bugs" Moran, who inherited leadership of the North Side Gang after the murders of O\'Banion and Weiss, has reportedly vowed revenge against Al Capone\'s South Side organization following the hijacking of a truck convoy carrying $30,000 worth of Canadian whisky. Moran was heard telling associates that he intends to "bury Capone in his own cement."',
    sourceUrl: 'https://en.wikipedia.org/wiki/Bugs_Moran',
  },

  // ── 1929 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1929-massacre',
    type: 'news', year: 1929, size: 'banner',
    headline: 'SEVEN MEN SLAUGHTERED IN CHICAGO GARAGE ON ST. VALENTINE\'S DAY',
    subheadline: 'Gunmen in Police Uniforms Execute Moran Gang Members; Capone Denies Involvement from Florida',
    publishedDate: 'February 15, 1929',
    body: 'Seven members of the Bugs Moran gang were lined against the wall of a Clark Street garage and executed by machine gun fire on Valentine\'s Day morning. The killers, at least two of whom wore police uniforms, escaped in a black sedan. Moran himself arrived late to the meeting and escaped. "Only Capone kills like that," Moran told reporters. Capone, reached at his Palm Island estate in Florida, expressed surprise and condolences.',
    imageUrl: '/newspaper/st_valentines_massacre.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Saint_Valentine%27s_Day_Massacre',
  },
  {
    id: 'news-1929-crash',
    type: 'news', year: 1929, size: 'banner',
    headline: 'WALL STREET IN PANIC; STOCKS COLLAPSE IN RECORD TRADING',
    subheadline: 'Billions Lost as Markets Plunge; Brokers Mob Exchange Floor',
    publishedDate: 'October 30, 1929',
    body: 'The New York Stock Exchange experienced its worst single-day collapse in history on Black Tuesday, as panicked selling sent values plummeting by billions of dollars. Scenes of chaos on the Exchange floor were repeated at brokerage houses across the country. President Hoover issued a statement assuring Americans that the "fundamental business of the country" remains sound. Economists are less certain.',
    imageUrl: '/newspaper/wall_street_crash.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Wall_Street_Crash_of_1929',
  },
  {
    id: 'news-1929-wickersham',
    type: 'news', year: 1929, size: 'brief',
    headline: 'HOOVER APPOINTS COMMISSION TO STUDY PROHIBITION ENFORCEMENT',
    publishedDate: 'May 21, 1929',
    body: 'President Hoover has named former Attorney General George Wickersham to chair a commission charged with evaluating the effectiveness of Prohibition enforcement. Critics from both the Wet and Dry camps greeted the appointment with skepticism. Senator James Reed of Missouri predicted that the commission would "study the situation to death while the bootleggers count their money."',
    sourceUrl: 'https://en.wikipedia.org/wiki/Wickersham_Commission',
  },

  // ── 1930 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1930-capone-tax',
    type: 'news', year: 1930, size: 'banner',
    headline: 'FEDERAL PROSECUTORS BUILD TAX EVASION CASE AGAINST CAPONE',
    subheadline: 'IRS Agents Reconstruct Years of Unreported Income from Bootleg Empire',
    publishedDate: 'June 12, 1930',
    body: 'The Internal Revenue Service, working in parallel with Prohibition Bureau agents, is assembling a case against Al Capone based on tax evasion rather than liquor violations. Capone\'s attorneys have long maintained their client has no demonstrable income; IRS special agent Frank Wilson has spent three years tracing cash flows through a labyrinth of front companies and corrupt bankers. Capone\'s estimated annual income of $60 million has never been reported to the government.',
    imageUrl: '/newspaper/al_capone.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Al_Capone',
  },
  {
    id: 'news-1930-depression',
    type: 'news', year: 1930, size: 'feature',
    headline: 'UNEMPLOYMENT ROLLS SWELL TO 4 MILLION AS DEPRESSION DEEPENS',
    publishedDate: 'March 17, 1930',
    body: 'The national unemployment rate has reached an estimated 8.7 percent, with breadlines stretching around city blocks in New York, Chicago, and Detroit. President Hoover has repeatedly declined to authorize direct federal relief, maintaining that private charity and local government are adequate to the task. Saloon keepers who went out of business in 1920 note with grim humor that business might otherwise be quite good.',
    imageUrl: '/newspaper/capone_soup_kitchen.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Great_Depression_in_the_United_States',
  },
  {
    id: 'news-1930-wickersham-report',
    type: 'news', year: 1930, size: 'brief',
    headline: 'WICKERSHAM REPORT FINDS PROHIBITION UNENFORCEABLE BUT RECOMMENDS CONTINUATION',
    publishedDate: 'January 20, 1931',
    body: 'The Wickersham Commission has issued a report acknowledging that Prohibition is widely violated, that enforcement is riddled with corruption, and that the law has enriched criminals while failing to reduce drinking. The Commission nevertheless recommends that Prohibition continue. The New York World published the eleven commissioners\' individual views alongside the official conclusion and noted that most of the commissioners privately favored repeal.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Wickersham_Commission',
  },

  // ── 1931 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1931-capone-convicted',
    type: 'news', year: 1931, size: 'banner',
    headline: 'CAPONE GUILTY ON TAX COUNTS; SENTENCED TO 11 YEARS IN FEDERAL PRISON',
    subheadline: 'Chicago\'s Most Feared Crime Lord to Report to Cook County Jail Pending Appeal',
    publishedDate: 'October 18, 1931',
    body: 'Al Capone was convicted yesterday in federal district court on five counts of income tax evasion and sentenced to eleven years in prison and $50,000 in fines. The verdict ends a decade-long reign over Chicago\'s underworld. Judge James Wilkerson, who had been tipped that Capone\'s attorneys planned to bribe the jury, switched the entire panel at the last moment. Capone smiled throughout sentencing and told reporters it was "a bum rap."',
    imageUrl: '/newspaper/al_capone.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Al_Capone',
  },
  {
    id: 'news-1931-empire-state',
    type: 'news', year: 1931, size: 'feature',
    headline: 'EMPIRE STATE BUILDING OPENS AS WORLD\'S TALLEST STRUCTURE',
    subheadline: '102-Story Tower Completed in Record 410 Days; President Hoover Illuminates Tower from Washington',
    publishedDate: 'May 2, 1931',
    body: 'The Empire State Building, standing 1,250 feet above Fifth Avenue, has officially opened to the public. President Hoover threw a switch in Washington that lit up the tower\'s beacon. The building\'s developers have had difficulty finding tenants in the depressed real estate market; wags have taken to calling it the "Empty State Building." Its observation deck drew 3,000 visitors on opening day.',
    imageUrl: '/newspaper/empire_state.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Empire_State_Building',
  },
  {
    id: 'news-1931-eliot-ness',
    type: 'news', year: 1931, size: 'brief',
    headline: 'TREASURY AGENT NESS AND "UNTOUCHABLES" RAID CAPONE BREWERIES',
    publishedDate: 'March 25, 1931',
    body: 'Eliot Ness, a 28-year-old Treasury agent leading a hand-picked team of incorruptible agents, has staged a series of headline-grabbing raids on breweries and distilleries linked to the Capone organization. Ness reportedly invited newspaper photographers along to each raid, ensuring maximum publicity. Capone\'s men reportedly offered Ness $2,000 a week in bribes; he declined.',
    imageUrl: '/newspaper/eliot_ness.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Eliot_Ness',
  },

  // ── 1932 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1932-fdr',
    type: 'news', year: 1932, size: 'banner',
    headline: 'ROOSEVELT WINS IN HISTORIC LANDSLIDE; PLEDGES "NEW DEAL" FOR AMERICA',
    subheadline: 'Democrat Carries 42 States; Hoover Carries 6; Repeal of Prohibition Seen as Certainty',
    publishedDate: 'November 9, 1932',
    body: 'Franklin D. Roosevelt has been elected the 32nd President of the United States in one of the largest electoral margins in the nation\'s history, carrying 42 states and 472 electoral votes. Roosevelt, who campaigned openly for Prohibition repeal and a sweeping program of economic relief, told supporters in New York that "a new chapter in our national life is about to be written." Drys expressed alarm; the nation\'s bootleggers began quietly surveying their options.',
    imageUrl: '/newspaper/fdr_portrait.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Franklin_D._Roosevelt',
  },
  {
    id: 'news-1932-lindbergh-kidnapping',
    type: 'news', year: 1932, size: 'feature',
    headline: 'LINDBERGH BABY KIDNAPPED FROM NEW JERSEY HOME; $50,000 RANSOM DEMANDED',
    publishedDate: 'March 2, 1932',
    body: 'Charles A. Lindbergh Jr., the 20-month-old son of America\'s most famous aviator, was taken from his crib at the Lindbergh estate near Hopewell, New Jersey, in the early morning hours. A ransom note demanding $50,000 was found on the nursery windowsill. President Hoover placed federal investigators at Colonel Lindbergh\'s disposal. The case has gripped the nation as no crime story since the Prohibition murders of Chicago.',
    imageUrl: '/newspaper/lindbergh_baby_poster.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Lindbergh_kidnapping',
  },
  {
    id: 'news-1932-bonus-army',
    type: 'news', year: 1932, size: 'brief',
    headline: 'ARMY ROUTS BONUS MARCHERS FROM WASHINGTON; HOOVER ORDERS ACTION',
    publishedDate: 'July 29, 1932',
    body: 'General Douglas MacArthur, acting on President Hoover\'s orders, has dispersed the Bonus Expeditionary Force — 20,000 World War veterans camped in Washington demanding early payment of service bonuses. Troops with fixed bayonets, tanks, and tear gas drove the marchers from their Anacostia shantytown and burned their tents. The action has outraged veterans\' groups and is expected to hasten Hoover\'s already likely defeat in November.',
    imageUrl: '/newspaper/bonus_army_camp.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Bonus_Army',
  },

  // ── 1933 ─────────────────────────────────────────────────────────────────

  {
    id: 'news-1933-repeal',
    type: 'news', year: 1933, size: 'banner',
    headline: 'PROHIBITION ENDS! TWENTY-FIRST AMENDMENT RATIFIED BY UTAH — THE LAST STATE NEEDED',
    subheadline: 'After 13 Years, 10 Months, and 19 Days, America May Drink Legally Once More',
    publishedDate: 'December 6, 1933',
    body: 'At 5:32 PM Eastern Time on December 5th, Utah became the 36th state to ratify the Twenty-First Amendment to the Constitution, repealing Prohibition. Crowds erupted in cities across the nation. In New York, beer trucks drove up Fifth Avenue to cheers. President Roosevelt signed a proclamation hours later. The great experiment — thirteen years of illicit supply chains, corrupted police forces, and enriched gangsters — is over.',
    imageUrl: '/newspaper/repeal_1933.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Twenty-first_Amendment_to_the_United_States_Constitution',
  },
  {
    id: 'news-1933-beer-legal',
    type: 'news', year: 1933, size: 'feature',
    headline: 'BEER FLOWS LEGALLY FOR FIRST TIME SINCE 1920 AS CULLEN-HARRISON ACT TAKES EFFECT',
    subheadline: 'FDR Signs Bill Legalizing 3.2% Beer; President Quips He Could Use a Drink',
    publishedDate: 'April 8, 1933',
    body: 'Low-alcohol beer and wine became legal today under the Cullen-Harrison Act, signed into law by President Roosevelt, who reportedly remarked "I think this would be a good time for a beer." Major breweries that survived Prohibition by producing near-beer, ice cream, and other legal products fired up their vats overnight. Lines stretched around the block at licensed establishments in every major city.',
    imageUrl: '/newspaper/after_prohibition.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Cullen%E2%80%93Harrison_Act',
  },
  {
    id: 'news-1933-dillinger',
    type: 'news', year: 1933, size: 'brief',
    headline: 'JOHN DILLINGER ESCAPES INDIANA PRISON; FBI DECLARES HIM PUBLIC ENEMY NO. 1',
    publishedDate: 'September 27, 1933',
    body: 'John Dillinger, convicted of bank robbery and sentenced to 10–20 years at Indiana State Prison, has escaped using a wooden pistol he fashioned and blackened with shoe polish. J. Edgar Hoover\'s Bureau of Investigation has declared Dillinger "Public Enemy Number One." With the end of Prohibition defunding many bootleg gangs, bank robbery has emerged as the glamour crime of the new decade.',
    imageUrl: '/newspaper/john_dillinger.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/John_Dillinger',
  },

  // ── Additional 1920 ───────────────────────────────────────────────────────

  {
    id: 'news-1920-ky-derby',
    type: 'news', year: 1920, size: 'brief',
    headline: 'CHURCHILL DOWNS SERVES NO WHISKEY FOR FIRST TIME IN 46 YEARS',
    publishedDate: 'May 8, 1920',
    body: 'The Kentucky Derby was run this week before record crowds who found the customary mint julep conspicuously absent from the infield. Vendors offered lemonade and soda water. Spectators who had planned ahead were observed reaching into coat pockets with suspicious frequency. Track officials noted that gate receipts remained robust despite the beverage situation.',
    imageUrl: '/newspaper/paul_jones_derby.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Prohibition_in_the_United_States',
  },
  {
    id: 'news-1920-breweries',
    type: 'news', year: 1920, size: 'brief',
    headline: 'NATION\'S GREAT BREWERIES PIVOT TO ICE CREAM AND NEAR BEER',
    publishedDate: 'January 24, 1920',
    body: 'Pabst, Schlitz, Blatz, and Miller — the titans of the American brewing industry — have announced emergency conversion plans as Prohibition takes hold. Pabst will produce cheese; Schlitz is pivoting to chocolate syrup; Miller will attempt legal near beer. Industry observers predict the conversions will not save more than a fraction of the jobs previously supported by legal brewing.',
    imageUrl: '/newspaper/near_beer_labels.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Pabst_Blue_Ribbon',
  },
  {
    id: 'news-1920-police-payoffs',
    type: 'news', year: 1920, size: 'brief',
    headline: 'NEW YORK PATROLMEN REFUSE TO ENFORCE VOLSTEAD ACT WITHOUT ADDITIONAL PAY',
    publishedDate: 'March 12, 1920',
    body: 'Rank-and-file officers of the New York Police Department have informally communicated to their commanders that Prohibition enforcement represents additional duties beyond their contracted responsibilities. Three precincts on the Lower East Side have reported zero arrests under the Volstead Act in its first two months of operation. Police Commissioner Enright declined to comment on what the men may be earning from other sources.',
    imageUrl: '/newspaper/bootlegger_cartoon.jpg',
  },

  // ── Additional 1921 ───────────────────────────────────────────────────────

  {
    id: 'news-1921-irs-bootleggers',
    type: 'news', year: 1921, size: 'brief',
    headline: 'REVENUE SERVICE OPENS NEW FRONT: BOOTLEGGER INCOME MUST BE DECLARED',
    publishedDate: 'October 7, 1921',
    body: 'The Internal Revenue Service has issued a formal ruling that income derived from illegal sources, including the manufacture and sale of intoxicating liquors, is subject to federal income tax. The ruling, derided as absurd in wet newspapers, may prove to be the government\'s sharpest weapon against organized bootlegging. Prosecutors note that proving unreported income is far simpler than proving the source of that income.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Tax_evasion_in_the_United_States',
  },
  {
    id: 'news-1921-women-flappers',
    type: 'news', year: 1921, size: 'feature',
    headline: 'NEW WOMAN OF THE TWENTIES DRINKS IN PUBLIC AND DARES YOU TO SAY SOMETHING',
    subheadline: 'Flapper Culture Upends Temperance Movement\'s Vision of a Sober, Demure America',
    publishedDate: 'August 22, 1921',
    body: 'The temperance reformers who fought for thirty years to close the nation\'s saloons could not have foreseen that their victory would coincide with the arrival of a generation of young women who regard mixed drinking as a mark of modernity. In the speakeasies of New York and Chicago, young women in short dresses smoke cigarettes and drink gin cocktails alongside men, scandalizing their mothers and the Women\'s Christian Temperance Union in equal measure.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flapper',
  },
  {
    id: 'news-1921-homewine',
    type: 'news', year: 1921, size: 'brief',
    headline: 'HOME WINE AND CIDER PRODUCTION SURGES UNDER LEGAL LOOPHOLE',
    publishedDate: 'March 4, 1921',
    body: 'A previously obscure provision of the Volstead Act permitting heads of household to produce up to 200 gallons of "non-intoxicating cider and fruit juices" annually has produced a remarkable boom in home fermentation. Hardware stores report brisk sales of crocks, airlocks, and grape presses. California grape growers, facing ruin after the closure of wineries, have found a new market shipping fresh grapes east to amateur winemakers.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Home_winemaking',
  },

  // ── Additional 1922 ───────────────────────────────────────────────────────

  {
    id: 'news-1922-capone-chicago',
    type: 'news', year: 1922, size: 'brief',
    headline: 'BROOKLYN-BORN AL CAPONE RISES IN CHICAGO OUTFIT',
    publishedDate: 'November 5, 1922',
    body: 'Alphonse Capone, a former Five Points gang member transplanted from Brooklyn to Chicago by his mentor Johnny Torrio, has taken on an increasingly visible role in the management of the Outfit\'s South Side operations. At twenty-three, Capone is reported to oversee protection payments, enforce territorial agreements, and recruit talent from East Coast gangs. Law enforcement officials describe him as "a young man in a hurry."',
    sourceUrl: 'https://en.wikipedia.org/wiki/Al_Capone',
  },
  {
    id: 'news-1922-prohibition-bureau',
    type: 'news', year: 1922, size: 'brief',
    headline: 'PROHIBITION BUREAU FIRES 100 AGENTS FOR BRIBERY AND CORRUPTION',
    publishedDate: 'May 16, 1922',
    body: 'Commissioner Roy Haynes of the Prohibition Bureau has confirmed the dismissal of 100 agents nationwide on charges ranging from accepting bribes to operating bootlegging routes themselves. The bureau, created hastily in 1920 with minimal vetting of its recruits, faces congressional criticism that it hired precisely the men it was supposed to arrest. Haynes promises a new regime of background checks and loyalty oaths.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Prohibition_Bureau',
  },
  {
    id: 'news-1922-strega',
    type: 'news', year: 1922, size: 'brief',
    headline: 'ITALIAN AND JEWISH NEIGHBORHOODS REPORT COMMERCIAL WINEMAKING BEHIND CLOSED DOORS',
    publishedDate: 'August 3, 1922',
    body: 'Federal agents conducting inspections on the Near West Side of Chicago and Manhattan\'s Lower East Side have found that communal and religious exemptions permitting sacramental wine have been interpreted with considerable latitude. Synagogues report dramatic increases in membership; Catholic parishes have doubled their orders of altar wine. Some congregations, agents note, appear to have more communicants than the local population.',
  },

  // ── Additional 1923 ───────────────────────────────────────────────────────

  {
    id: 'news-1923-coolidge-enforcement',
    type: 'news', year: 1923, size: 'brief',
    headline: 'PRESIDENT COOLIDGE VOWS FIRM ENFORCEMENT; CRITICS CALL SPEECH EMPTY',
    publishedDate: 'September 1, 1923',
    body: 'Calvin Coolidge, newly sworn as the 30th President following the death of Warren Harding, has pledged to uphold the Eighteenth Amendment with full federal resources. The pledge has been met with skepticism by both wet and dry factions — wets because they disbelieve him, drys because they\'ve heard it before. The Prohibition Bureau\'s budget remains unchanged.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Calvin_Coolidge',
  },
  {
    id: 'news-1923-radio',
    type: 'news', year: 1923, size: 'brief',
    headline: 'RADIO BROADCASTS JAZZ FROM SPEAKEASY ORCHESTRAS TO LIVING ROOMS NATIONWIDE',
    publishedDate: 'June 14, 1923',
    body: 'Station KDKA in Pittsburgh and WGN in Chicago have begun broadcasting live music from venues that, if one were to visit them in person, would require a password and a working knowledge of back alleys. The separation between the music and the liquor that accompanies it in situ has not been lost on temperance groups, who have called for the Federal Radio Commission to investigate.',
    sourceUrl: 'https://en.wikipedia.org/wiki/History_of_radio',
  },
  {
    id: 'news-1923-lucky-luciano',
    type: 'news', year: 1923, size: 'brief',
    headline: 'YOUNG LUCIANO ARRESTED FOR HEROIN — MAKES DEAL, WALKS FREE',
    publishedDate: 'May 2, 1923',
    body: 'Salvatore Lucania, known on Manhattan\'s Lower East Side as "Lucky Luciano," was arrested this spring on narcotics charges and promptly demonstrated the negotiating skills that would make him famous. Trading information for leniency, Luciano was released with a suspended sentence. Observers of the city\'s underworld note that the young man has shifted his principal attention to the more profitable, and less prosecuted, liquor trade.',
    imageUrl: '/newspaper/lucky_luciano.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Lucky_Luciano',
  },

  // ── Additional 1924 ───────────────────────────────────────────────────────

  {
    id: 'news-1924-torrio-retires',
    type: 'news', year: 1924, size: 'brief',
    headline: 'TORRIO SURVIVES AMBUSH, PROMPTLY RETIRES AND SAILS FOR ITALY',
    publishedDate: 'February 16, 1925',
    body: 'Johnny Torrio, the mastermind behind Chicago\'s largest bootlegging syndicate, survived a point-blank assassination attempt outside his apartment and immediately announced his retirement. "I\'ve had enough," Torrio reportedly told a colleague from his hospital bed. He will leave his considerable Chicago operations in the hands of his protégé, the 25-year-old Alphonse Capone, who has expressed no desire to retire.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Johnny_Torrio',
  },
  {
    id: 'news-1924-record-seizures',
    type: 'news', year: 1924, size: 'brief',
    headline: 'PROHIBITION BUREAU REPORTS RECORD 172,000 STILLS SEIZED IN CALENDAR YEAR',
    publishedDate: 'July 4, 1924',
    body: 'The Prohibition Bureau released figures showing federal agents destroyed 172,537 illegal stills during the past year — a new record. Skeptics note that production of illegal spirits does not appear to have declined, and that the figure may reflect the proliferation of small home stills rather than any disruption of the major bootlegging networks. "We are winning," declared Commissioner Haynes. The speakeasies were unavailable for comment.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Prohibition_in_the_United_States',
  },
  {
    id: 'news-1924-detroit-windsor',
    type: 'news', year: 1924, size: 'brief',
    headline: 'DETROIT AGENTS DISCOVER PIPELINE UNDER RIVER DELIVERING CANADIAN WHISKY',
    publishedDate: 'October 20, 1924',
    body: 'Federal agents in Detroit have uncovered what they describe as the most audacious smuggling operation yet encountered: a flexible hose pipeline running under the Detroit River from Windsor, Ontario, through which Canadian whisky was pumped directly into a warehouse on the American side. The operation, which had been functioning for an estimated eight months, delivered an estimated fifty gallons per hour at peak capacity.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Prohibition_in_the_United_States',
  },

  // ── Additional 1925 ───────────────────────────────────────────────────────

  {
    id: 'news-1925-airplanes',
    type: 'news', year: 1925, size: 'brief',
    headline: 'BOOTLEGGERS TAKE TO THE AIR AS FEDERAL AGENTS PATROL THE ROADS',
    publishedDate: 'June 22, 1925',
    body: 'Revenue agents report a new frontier in liquor smuggling: surplus military aircraft are being used to ferry Canadian whisky and Caribbean rum across the border by night. Small airfields carved into remote fields in the Adirondacks and the Upper Midwest serve as landing strips for what one agent described as "a regular air express service for illegal spirits." The Prohibition Bureau has no aircraft of its own.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Prohibition_in_the_United_States',
  },
  {
    id: 'news-1925-chicago-beer-wars',
    type: 'news', year: 1925, size: 'brief',
    headline: 'CHICAGO BEER WARS CLAIM 12 LIVES IN THREE MONTHS',
    publishedDate: 'August 9, 1925',
    body: 'The contest for control of Chicago\'s illegal beer routes has produced a summer of exceptional violence. Twelve men have been killed in drive-by shootings, ambushes, and what the police department delicately refers to as "occupational accidents." The Tribune has taken to running the casualties in a regular tabulation under the headline "The Week\'s Score." Mayor Dever has promised action; Capone\'s market share has grown to an estimated sixty percent.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Chicago_Outfit',
  },
  {
    id: 'news-1925-drugstores',
    type: 'news', year: 1925, size: 'brief',
    headline: 'DRUGSTORE CHAINS REPORT MIRACULOUS SURGE IN CUSTOMERS SEEKING MEDICINAL SPIRITS',
    publishedDate: 'December 1, 1925',
    body: 'Walgreen\'s Drug Stores, with 44 locations in 1920, reports it will open its 500th store by year\'s end — a growth trajectory that company executives attribute to the public\'s increased attention to health. The chain\'s robust business in physician-prescribed medicinal whiskey is not mentioned in the annual report, though industry observers have drawn the obvious conclusions. Physicians in Chicago write an average of one whiskey prescription every six minutes.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Walgreens',
  },

  // ── Additional 1926 ───────────────────────────────────────────────────────

  {
    id: 'news-1926-machine-gun-kelly',
    type: 'news', year: 1926, size: 'brief',
    headline: 'MEMPHIS BOOTLEGGER GEORGE KELLY GRADUATES FROM LIQUOR TO ARMED ROBBERY',
    publishedDate: 'September 17, 1926',
    body: 'George "Machine Gun" Kelly Barnes, previously known to Memphis federal agents as a mid-level bootlegger with a talent for avoiding arrest, has reportedly expanded his criminal portfolio to include bank robbery. Kelly, whose primary qualification appears to be a willingness to carry a Thompson submachine gun, has parted ways with the liquor trade just as competition from better-organized Chicago interests made the Memphis market less rewarding.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Machine_Gun_Kelly',
  },
  {
    id: 'news-1926-mexico',
    type: 'news', year: 1926, size: 'brief',
    headline: 'TEQUILA SMUGGLING FROM MEXICO GROWS AS BORDER AGENTS FOCUS ON WHISKEY',
    publishedDate: 'April 14, 1926',
    body: 'Customs agents along the Texas and Arizona borders report a surge in tequila, mezcal, and Mexican brandy crossing north by wagon, automobile, and on the backs of pack mules. The attention of federal enforcement being largely concentrated on Canadian whisky and East Coast rum, the southern border has proved an inviting route for Mexican distillers, some of whom have established what amounts to a standing export business to American bootleggers.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Tequila',
  },
  {
    id: 'news-1926-capone-peace',
    type: 'news', year: 1926, size: 'brief',
    headline: 'CAPONE BROKERS CHICAGO GANG PEACE CONFERENCE AT HOTEL SHERMAN',
    publishedDate: 'October 21, 1926',
    body: 'Al Capone, now the undisputed king of Chicago\'s South Side, has organized what the Tribune describes as a "bootleggers\' summit" at the Hotel Sherman, bringing together the major operators of the city\'s illegal liquor trade in an attempt to end two years of territorial warfare. The conference, improbably, appears to have succeeded. City homicide rates dropped sharply in the weeks following the summit, though police attribute this to seasonal factors.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Al_Capone',
  },

  // ── Additional 1927 ───────────────────────────────────────────────────────

  {
    id: 'news-1927-luciano-network',
    type: 'news', year: 1927, size: 'brief',
    headline: 'LUCIANO BUILDS EAST COAST SYNDICATE LINKING NEW YORK, PHILADELPHIA, BOSTON',
    publishedDate: 'March 7, 1927',
    body: 'Law enforcement sources in New York, Philadelphia, and Boston report mounting evidence that Lucky Luciano has established coordinated distribution agreements among previously competing Italian and Jewish bootlegging operations along the Eastern Seaboard. The arrangement, described by one federal agent as "a trade association for criminals," ensures consistent pricing, territorial respect, and mutual defense against rivals and law enforcement alike.',
    imageUrl: '/newspaper/lucky_luciano.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Lucky_Luciano',
  },
  {
    id: 'news-1927-flood',
    type: 'news', year: 1927, size: 'brief',
    headline: 'MISSISSIPPI FLOOD DISRUPTS SOUTHERN LIQUOR SUPPLY ROUTES',
    publishedDate: 'April 30, 1927',
    body: 'The great Mississippi flood of 1927, which has displaced 700,000 people across seven states, has also disrupted the elaborate distribution networks that channel illegal spirits from Gulf Coast ports and Appalachian stills to northern cities. Bootleggers in Chicago and St. Louis report temporary shortages of corn whiskey and New Orleans rum. Supply is expected to normalize once the roads are passable, which federal agents acknowledge will be before the courts are.',
    imageUrl: '/newspaper/mississippi_flood.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Great_Mississippi_Flood_of_1927',
  },
  {
    id: 'news-1927-talkie',
    type: 'news', year: 1927, size: 'brief',
    headline: 'JAZZ SINGER JOLSON USHERS IN TALKING PICTURES; SPEAKEASY OWNERS UNTROUBLED',
    publishedDate: 'October 7, 1927',
    body: 'The Jazz Singer, featuring Al Jolson in the first commercially successful talking motion picture, has taken the country by storm. Theatre owners who feared that talking pictures would keep audiences home are instead reporting lines around the block. Speakeasy operators, who had briefly worried about competition from neighborhood cinemas, note with satisfaction that motion pictures do not yet serve cocktails.',
    imageUrl: '/newspaper/al_jolson_jazz_singer.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/The_Jazz_Singer_(1927_film)',
  },

  // ── Additional 1928 ───────────────────────────────────────────────────────

  {
    id: 'news-1928-smith-wet',
    type: 'news', year: 1928, size: 'brief',
    headline: 'AL SMITH RUNS AS THE WET CANDIDATE; DRYS RALLY TO HOOVER',
    publishedDate: 'July 27, 1928',
    body: 'Governor Alfred E. Smith of New York, the Democratic nominee for president, has made no secret of his support for Prohibition\'s repeal, providing voters with an unusually clear choice on the liquor question. Herbert Hoover, the Republican, calls Prohibition "a great social and economic experiment, noble in motive." Drys regard the election as a referendum; wets regard it as a popularity contest in which Smith\'s Catholicism and New York accent doom him regardless of his platform.',
    imageUrl: '/newspaper/al_smith.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/1928_United_States_presidential_election',
  },
  {
    id: 'news-1928-jazz-age',
    type: 'news', year: 1928, size: 'brief',
    headline: 'HARLEM RENAISSANCE PRODUCES MUSIC, LITERATURE, AND AN INEXHAUSTIBLE THIRST',
    publishedDate: 'February 11, 1928',
    body: 'The Cotton Club, the Savoy Ballroom, and a dozen other Harlem institutions have made the neighborhood the cultural capital of Black America — and, incidentally, of illicit drinking. The Cotton Club, owned by bootlegger Owney Madden, serves his Madden\'s No. 1 beer alongside performances by Duke Ellington and Cab Calloway. Federal agents have noted the establishment\'s existence but appear to find it inconvenient to raid.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Harlem_Renaissance',
  },
  {
    id: 'news-1928-purple-gang-violence',
    type: 'news', year: 1928, size: 'brief',
    headline: 'DETROIT\'S PURPLE GANG MASSACRES RIVAL BOOTLEGGERS IN MILAFLORES APARTMENT',
    publishedDate: 'November 19, 1928',
    body: 'Detroit police have discovered the bodies of three men in the Milaflores Apartments, their deaths attributed to the Purple Gang, a predominantly Jewish criminal organization that has consolidated control over the Detroit-Windsor whisky corridor. The Purple Gang, named by a shopkeeper who described its young members as "off-color, like spoiled meat," now controls the distribution of Canadian liquor across Michigan and into Ohio.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Purple_Gang',
  },

  // ── Additional 1929 ───────────────────────────────────────────────────────

  {
    id: 'news-1929-capone-florida',
    type: 'news', year: 1929, size: 'brief',
    headline: 'CAPONE REPORTS FLORIDA ALIBI AS CHICAGO MASSACRE DOMINATES HEADLINES',
    publishedDate: 'January 13, 1929',
    body: 'Al Capone, vacationing at his Palm Island estate when the St. Valentine\'s Day Massacre occurred, has made his alibi available to any journalist willing to make the trip to Miami. "I was playing cards," Capone told the Miami Tribune. "Ask anybody." Law enforcement officials in Chicago, who have no evidence connecting Capone to the killings, appear content to leave the matter there. The massacre has, in any event, substantially reduced Bugs Moran\'s organizational capacity.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Saint_Valentine%27s_Day_Massacre',
  },
  {
    id: 'news-1929-untouchables',
    type: 'news', year: 1929, size: 'brief',
    headline: 'TREASURY AGENT ELIOT NESS ASSEMBLES TEAM OF INCORRUPTIBLE AGENTS',
    publishedDate: 'August 3, 1929',
    body: 'Eliot Ness, a 26-year-old University of Chicago graduate now working for the Treasury Department\'s Prohibition unit, has begun assembling a handpicked team of agents selected specifically for their resistance to bribery. The group, which will focus on building a case against Al Capone\'s brewery operations, is said to have been vetted personally by Ness. Capone\'s people, having attempted to bribe several members and failed, have taken to calling them "the Untouchables."',
    sourceUrl: 'https://en.wikipedia.org/wiki/The_Untouchables_(law_enforcement)',
  },
  {
    id: 'news-1929-depression-speakeasies',
    type: 'news', year: 1929, size: 'brief',
    headline: 'STOCK MARKET RUIN DRIVES FORMERLY PROSPEROUS MEN TO THE SPEAKEASY',
    publishedDate: 'December 14, 1929',
    body: 'Proprietors of New York\'s better speakeasies report a curious shift in their clientele since the October crash. Men who previously visited on Friday and Saturday evenings are now appearing on Tuesday afternoons. "They\'re not celebrating," one barkeep told this paper. "They\'re not celebrating at all." The price of bootleg whiskey has not declined in sympathy with other commodities, a fact that seems not to discourage consumption.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Wall_Street_Crash_of_1929',
  },

  // ── Additional 1930 ───────────────────────────────────────────────────────

  {
    id: 'news-1930-national-crime',
    type: 'news', year: 1930, size: 'brief',
    headline: 'CONGRESSIONAL REPORT FINDS ORGANIZED CRIME NOW OPERATING ACROSS STATE LINES',
    publishedDate: 'September 9, 1930',
    body: 'A Senate subcommittee report on organized crime has concluded that the major bootlegging syndicates have developed into national enterprises with operations in every major American city, formal territorial agreements, shared legal counsel, and communication systems that outpace those of federal law enforcement. The report recommends the creation of a national law enforcement agency with jurisdiction to pursue criminals across state lines — a proposal that J. Edgar Hoover endorses enthusiastically.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Organized_crime_in_the_United_States',
  },
  {
    id: 'news-1930-dry-lobby',
    type: 'news', year: 1930, size: 'brief',
    headline: 'ANTI-SALOON LEAGUE WARNS REPEAL WOULD RETURN NATION TO MORAL RUIN',
    publishedDate: 'April 22, 1930',
    body: 'The Anti-Saloon League, facing its first serious political setbacks since the passage of the Eighteenth Amendment, has mounted an expensive lobbying campaign warning that repeal would restore the pre-Prohibition saloon in all its worst forms. Critics point out that the current situation already features widespread drinking, organized crime, corruption, and poisoned liquor — amenities the old saloon did not typically offer.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Anti-Saloon_League',
  },
  {
    id: 'news-1930-sterno',
    type: 'news', year: 1930, size: 'brief',
    headline: 'HOSPITALS TREAT RECORD CASES OF BLINDNESS FROM INDUSTRIAL-GRADE SPIRITS',
    publishedDate: 'November 3, 1930',
    body: 'City hospitals from New York to Los Angeles are reporting unprecedented numbers of patients blinded or killed by consumption of industrial alcohol, Sterno canned heat, and wood alcohol sold as drinking spirits. The Treasury Department\'s policy of requiring industrial alcohol to be adulterated with methanol and other poisons — intended to make it undrinkable — has instead produced a plague of accidental poisoning among the poorest drinkers, who cannot afford bootleg spirits of reliably non-lethal quality.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Prohibition_in_the_United_States',
  },

  // ── Additional 1931 ───────────────────────────────────────────────────────

  {
    id: 'news-1931-five-families',
    type: 'news', year: 1931, size: 'brief',
    headline: 'NEW YORK BOOTLEG TRADE REORGANIZED UNDER FIVE-FAMILY ARRANGEMENT',
    publishedDate: 'August 11, 1931',
    body: 'The assassination of Joe Masseria and Salvatore Maranzano has cleared the field for Lucky Luciano to reorganize the New York underworld along more corporate lines. Five family organizations, each with its own territory, leadership structure, and seat on a governing commission, now divide the city\'s bootlegging, gambling, and labor rackets. The arrangement, described by one law enforcement official as "the most efficiently run criminal enterprise in American history," has reduced turf war casualties to a fraction of their 1929 levels.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Five_Families',
  },
  {
    id: 'news-1931-wickersham-2',
    type: 'news', year: 1931, size: 'brief',
    headline: 'WICKERSHAM COMMISSIONERS PERSONALLY DRINK; PUBLICLY OPPOSE REPEAL',
    publishedDate: 'January 21, 1931',
    body: 'The eleven members of the Wickersham Commission, whose report declared Prohibition unenforceable while recommending its continuation, have become objects of national ridicule. Franklin Pierce Adams of the World has published a devastating doggerel summarizing their position: "Prohibition is an awful flop. We like it. / It can\'t stop what it\'s meant to stop. We like it." The commission\'s members have declined to respond in verse.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Wickersham_Commission',
  },
  {
    id: 'news-1931-scarface-book',
    type: 'news', year: 1931, size: 'brief',
    headline: 'CAPONE CONVICTED ON TAX CHARGES AS BOOTLEG EMPIRE TOTTERS',
    publishedDate: 'June 30, 1931',
    body: 'The conviction of Al Capone on charges of tax evasion has sent tremors through Chicago\'s underground economy. With their figurehead facing eleven years in federal prison, the Outfit\'s mid-level operators are jostling for position. Frank Nitti, the Enforcer, is expected to assume day-to-day management. Beer distribution contracts are being renegotiated throughout the metropolitan area, and prices at certain speakeasies have risen by as much as fifteen percent.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Al_Capone',
  },

  // ── Additional 1932 ───────────────────────────────────────────────────────

  {
    id: 'news-1932-repeal-debate',
    type: 'news', year: 1932, size: 'brief',
    headline: 'CONGRESS DEBATES REPEAL AS BOTH PARTIES SEEK COVER ON THE LIQUOR QUESTION',
    publishedDate: 'February 18, 1932',
    body: 'For the first time since ratification, both major political parties are openly discussing the repeal of the Eighteenth Amendment. The Depression has undermined the dry coalition\'s political math: a legal, taxed liquor industry would generate federal revenue estimated at $500 million annually — money the government conspicuously does not have. The Anti-Saloon League, sensing the tide, has shifted its position from permanent prohibition to state-by-state option.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Twenty-first_Amendment_to_the_United_States_Constitution',
  },
  {
    id: 'news-1932-beer-revenue',
    type: 'news', year: 1932, size: 'brief',
    headline: 'BEER AND WINE REVENUE ACT WOULD LEGALIZE 3.2 PERCENT BEER',
    publishedDate: 'April 5, 1932',
    body: 'Congressman James M. Beck of Pennsylvania has introduced legislation that would legalize beer of 3.2 percent alcohol content, arguing that such a beverage is scientifically non-intoxicating and therefore not prohibited under the Eighteenth Amendment. Breweries have dusted off their copper kettles in anticipation. Temperance groups have declared that 3.2 percent beer is a Trojan horse for repeal. Both sides may be right.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Cullen%E2%80%93Harrison_Act',
  },
  {
    id: 'news-1932-olympics',
    type: 'news', year: 1932, size: 'brief',
    headline: 'LOS ANGELES OLYMPIC GAMES OPEN DRY — ATHLETES DISAGREE',
    publishedDate: 'August 3, 1932',
    body: 'The Tenth Olympiad, held in Los Angeles under California\'s Prohibition statutes, has produced an international incident as foreign delegations demand access to their national beverages. The French team has threatened to withdraw unless wine is made available; the Germans have lodged a formal protest regarding beer. The Organizing Committee has quietly arranged for discreet supplies to be available in the athletes\' village, where federal agents have chosen not to conduct inspections.',
    sourceUrl: 'https://en.wikipedia.org/wiki/1932_Summer_Olympics',
  },

  // ── Additional 1933 ───────────────────────────────────────────────────────

  {
    id: 'news-1933-ratification',
    type: 'news', year: 1933, size: 'brief',
    headline: 'STATES RACE TO RATIFY TWENTY-FIRST AMENDMENT AS PROHIBITION NEARS END',
    publishedDate: 'October 19, 1933',
    body: 'State ratification conventions are meeting across the country to vote on the Twenty-first Amendment repealing Prohibition, and the pace is extraordinary. Michigan ratified first; Pennsylvania followed within the week. The dry states of the South are expected to hold out, but their resistance is irrelevant — the required thirty-six states will ratify before the year\'s end. Distillers are already advertising. Breweries are already brewing.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Twenty-first_Amendment_to_the_United_States_Constitution',
  },
  {
    id: 'news-1933-last-raid',
    type: 'news', year: 1933, size: 'brief',
    headline: 'FEDERAL AGENTS CONDUCT FINAL RAIDS EVEN AS REPEAL LOOMS',
    publishedDate: 'December 3, 1933',
    body: 'Prohibition agents, their agency facing imminent abolition, have conducted a last flurry of raids on speakeasies and distilleries in New York, Chicago, and Detroit. The bootleggers are not particularly frightened. "What are they going to do, arrest me for something that\'ll be legal by Christmas?" one operator told the Tribune. Many speakeasy owners are already applying for liquor licenses, in some cases decorating with the same fixtures they installed illegally a decade ago.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Prohibition_in_the_United_States',
  },
  {
    id: 'news-1933-bootleggers-pivot',
    type: 'news', year: 1933, size: 'brief',
    headline: 'BOOTLEGGERS PIVOT TO GAMBLING AND LABOR RACKETS AS LIQUOR TRADE GOES LEGAL',
    publishedDate: 'November 14, 1933',
    body: 'With Prohibition\'s end, the criminal organizations that built their fortunes on illegal liquor are not disbanding — they are diversifying. The Outfit in Chicago, the Five Families in New York, and allied organizations in a dozen other cities are redeploying capital and personnel into gambling, labor union control, and legitimate businesses purchased with bootleg profits. The government spent thirteen years failing to stop them from selling beer; now they are selling something else.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Organized_crime_in_the_United_States',
  },

  // ── OPINION PIECES (any Prohibition era, year = 0 for wild-card) ──────────

  {
    id: 'opinion-dry-noble',
    type: 'opinion', year: 0, size: 'feature',
    headline: 'THE NOBLE EXPERIMENT MUST BE GIVEN TIME TO WORK',
    author: 'Cornelius J. Whitmore, Editor-in-Chief',
    authorImageUrl: '/newspaper/authors/whitmore.jpg',
    subheadline: 'By the Editors',
    body: 'Critics of the Eighteenth Amendment are fond of pointing to the speakeasies, the gangsters, and the corrupted policemen as evidence of Prohibition\'s failure. They are wrong to do so. No great moral reform yields its fruit in a single season. The saloon did not fall in a day; neither will the habits it cultivated. Give the law time, fund its enforcement adequately, and the day will come when Americans will look back on the Wet years as a dark chapter mercifully closed.',
  },
  {
    id: 'opinion-wet-futile',
    type: 'opinion', year: 0, size: 'feature',
    headline: 'PROHIBITION HAS GIVEN US CAPONE IN PLACE OF COORS',
    author: 'Thomas F. Walsh, Political Correspondent',
    authorImageUrl: '/newspaper/authors/merritt.jpg',
    subheadline: 'A Dissenting View from a Man Who Preferred His Bourbon Legal',
    body: 'The Eighteenth Amendment promised us a nation of sober, productive citizens. What it has delivered is a nation of hypocrites, a police force on the take, and a criminal class richer than small nations. Before Prohibition, a man who wished to drink bought his whiskey from a regulated merchant who paid his taxes. Today the same man buys it from a boy with a gun and no discernible address. This is called progress by those who brought it to us.',
  },
  {
    id: 'opinion-women-temperance',
    type: 'opinion', year: 0, size: 'feature',
    headline: 'THE WCTU HAS EARNED ITS VICTORY — NOW COMES THE HARDER WORK',
    author: 'Mrs. E. M. Whitfield, WCTU Chapter President',
    authorImageUrl: '/newspaper/authors/whitfield.jpg',
    subheadline: 'By Mrs. E. M. Whitfield, Chapter President',
    body: 'For forty years the women of the Woman\'s Christian Temperance Union marched, prayed, and petitioned for the amendment that is now the law of the land. Our daughters and granddaughters have inherited a nation where no man may legally ruin his family at a bar counter. But we knew from the beginning that law alone was insufficient. The saloon is gone; its spirit lingers. Education, not merely legislation, must complete what we have begun.',
  },
  {
    id: 'opinion-economics',
    type: 'opinion', year: 0, size: 'feature',
    headline: 'ON THE CURIOUS ECONOMICS OF MAKING A THING ILLEGAL',
    author: 'Prof. Edward A. Dunning, Dept. of Political Economy',
    authorImageUrl: '/newspaper/authors/dunning.jpg',
    subheadline: 'A Note from a Student of Commerce',
    body: 'A free market will always find a price at which supply meets demand. Prohibition does not extinguish the demand for spirits; it drives that demand underground, raises prices, and substitutes an illegal supply chain for a legal one. The tax revenues that once funded schools and roads now fund the wardrobes of bootleggers. The government has not abolished the liquor trade; it has merely changed its management.',
  },
  {
    id: 'opinion-rural-dry',
    type: 'opinion', year: 0, size: 'brief',
    headline: 'THE CITY HAS NO RIGHT TO DEMAND THAT THE COUNTRY SHARE ITS VICES',
    author: 'Earl W. Hutchins, Grain Farmer, Decatur, Illinois',
    authorImageUrl: '/newspaper/authors/hutchins.jpg',
    body: 'The repeal movement is a movement of the cities — of immigrants, of Catholics, of men who have never known the wreckage that drink leaves in a farming community. Let the Wets of New York and Chicago speak for themselves. The dry counties of the South and Middle West are not laboratories for other men\'s social experiments.',
  },
  {
    id: 'opinion-enforcement',
    type: 'opinion', year: 0, size: 'brief',
    headline: 'A PROHIBITION AGENT CONFESSES: WE CANNOT WIN THIS WAR',
    author: 'James R. Calloway, Special Correspondent',
    authorImageUrl: '/newspaper/authors/calloway.jpg',
    body: 'I have served four years in the Prohibition Bureau and I tell you plainly what my superiors refuse to admit in public: we are outnumbered, outspent, and outgunned. For every still we destroy, three more open. The men who bribe us earn in a month what we earn in a year. We are not failing for lack of virtue; we are failing for lack of arithmetic.',
  },
  {
    id: 'opinion-cocktail-culture',
    type: 'opinion', year: 0, size: 'brief',
    headline: 'PROHIBITION HAS PRODUCED THE FINEST COCKTAILS IN THE NATION\'S HISTORY',
    author: 'Miss Dorothy Lane, New York City',
    authorImageUrl: '/newspaper/authors/lane.jpg',
    body: 'There is one undeniable benefit of Prohibition that the temperance press declines to mention: the quality of mixed drinks available in the better New York speakeasies is without precedent. When the spirit itself is often barely palatable, the mixologist is forced to innovate. The gin martini, the sidecar, and the bee\'s knees are all gifts of this supposedly dry era.',
  },
  {
    id: 'opinion-canada',
    type: 'opinion', year: 0, size: 'brief',
    headline: 'OUR FRIENDS IN CANADA THANK US FOR OUR CONTINUED CUSTOM',
    author: 'Thomas F. Walsh, Political Correspondent',
    authorImageUrl: '/newspaper/authors/merritt.jpg',
    body: 'The Dominion of Canada did not impose Prohibition upon itself, and it has prospered accordingly. The Seagram and Hiram Walker distilleries operate at full capacity, their products destined largely for American shores. The Canadian government collects the excise taxes; the American government collects the bodies. Some would call this arrangement a triumph of federalism.',
  },
  {
    id: 'opinion-jazzsinger',
    type: 'opinion', year: 0, size: 'brief',
    headline: 'JAZZ MUSIC AND BOOTLEG WHISKEY: PRODUCTS OF THE SAME CORRUPT SOIL',
    author: 'Rev. Harlan B. Gould, Anti-Vice Society of Greater Detroit',
    authorImageUrl: '/newspaper/authors/gould.jpg',
    body: 'The Anti-Vice Society of Greater Detroit wishes it to be known that the spread of so-called "jazz" music through our city\'s speakeasies is not unrelated to the spread of illicit spirits. Both are products of the same moral degradation, the same willful casting-off of Christian restraint. Young men and women who frequent these establishments are imperiling not only their bodies but their souls.',
  },
  {
    id: 'opinion-repealist',
    type: 'opinion', year: 0, size: 'feature',
    headline: 'THE CASE FOR REPEAL: THIRTEEN REASONS IN THIRTEEN YEARS',
    author: 'James R. Calloway, Special Correspondent',
    authorImageUrl: '/newspaper/authors/calloway.jpg',
    body: 'The Wet argument can be stated simply: Prohibition was promised to reduce crime, poverty, and intemperance. It has increased all three while adding corruption on a scale previously unimagined in American public life. The law that cannot be enforced is worse than no law at all, for it breeds contempt for all laws. The Eighteenth Amendment should be repealed, the liquor trade regulated and taxed, and the revenue directed to the social improvements that Prohibition promised and failed to deliver.',
  },
  {
    id: 'opinion-irish-immigrant',
    type: 'opinion', year: 0, size: 'feature',
    headline: 'MY GRANDFATHER DISTILLED POITIN IN COUNTY CLARE; I DISTILL IT ON HALSTED STREET',
    author: "Patrick J. O'Brien, Halsted Street, Chicago",
    authorImageUrl: '/newspaper/authors/obrien.jpg',
    subheadline: 'A Letter from Patrick O\'Brien of Chicago',
    body: 'The Prohibitionists have made criminals of half the men in this city who were otherwise law-abiding. My grandfather made his whiskey in the hills of Clare; my father made his in a Newark boarding house; I make mine in a building on Halsted Street. In three generations we have moved from the countryside to the tenement to — at last — the headlines of this newspaper. I am told this is progress. I remain skeptical.',
  },
  {
    id: 'opinion-banker-dry',
    type: 'opinion', year: 0, size: 'brief',
    headline: 'SOBRIETY IS GOOD FOR BUSINESS AND BETTER FOR WORKERS',
    author: "Harold G. Merritt, National Business Men's Association",
    authorImageUrl: '/newspaper/authors/merritt.jpg',
    body: 'The National Business Men\'s Association has long supported the dry cause, and the evidence continues to vindicate that position. Absenteeism in factories is down. Industrial accidents are down. Men who once drank their wages on Friday evenings now bring them home. Whatever philosophical objections one may raise against Prohibition, the ledger books of American industry record its benefits in unmistakable figures.',
  },
  {
    id: 'opinion-speakeasy-hostess',
    type: 'opinion', year: 0, size: 'brief',
    headline: 'I RUN A SPEAKEASY AND I WILL NOT APOLOGIZE FOR IT',
    author: 'Agnes P. Doyle, Proprietress, East 52nd Street',
    authorImageUrl: '/newspaper/authors/doyle.jpg',
    body: 'I have operated a licensed restaurant on East 52nd Street for six years. The only difference now is that when a customer asks for a cocktail, I give him one and we both pretend he asked for ginger ale. The city is full of people who passed the Eighteenth Amendment and the same people who ignore it every evening. I am simply the woman in the middle, and I expect no sympathy from the press.',
  },
  {
    id: 'opinion-physician',
    type: 'opinion', year: 0, size: 'feature',
    headline: 'AS YOUR PHYSICIAN, I AM REQUIRED TO RECOMMEND WHISKEY',
    author: 'Dr. Reginald P. Fitch, M.D., F.A.C.S.',
    authorImageUrl: '/newspaper/authors/fitch.jpg',
    subheadline: 'On the Medical Exemption That Has Made Every Doctor a Bartender',
    body: 'The Volstead Act permits physicians to prescribe spirits for medicinal purposes. I have therefore prescribed whiskey for neurasthenia, influenza, cold feet, warm feet, anxiety, and excessive good health. My waiting room is full of patients I have never met before who require spirits urgently. I do not judge them. Honest men differ on the ethics of a law they find absurd; the conscientious physician\'s first duty is to his patient\'s well-being, which currently requires a prescription pad and a sympathetic disposition.',
  },
  {
    id: 'opinion-young-woman',
    type: 'opinion', year: 0, size: 'brief',
    headline: 'MOTHER SAYS THE SPEAKEASY IS DANGEROUS; MOTHER HAS NEVER BEEN TO A SPEAKEASY',
    author: 'Miss Dorothy Lane, New York City',
    authorImageUrl: '/newspaper/authors/lane.jpg',
    body: 'My mother was a temperance marcher. She believes I am in peril every time I set foot in a speakeasy. What she does not understand is that the speakeasy is the only place in this city where a woman can sit down with a man as an equal, order her own drink, and not be asked what she is doing out alone. The saloon she helped abolish would never have allowed me through its doors at all.',
  },
  {
    id: 'opinion-farmer',
    type: 'opinion', year: 0, size: 'brief',
    headline: 'THE GRAIN FARMER HAS NO QUARREL WITH PROHIBITION — HE SELLS TO BOTH SIDES',
    author: 'Earl W. Hutchins, Grain Farmer, Decatur, Illinois',
    authorImageUrl: '/newspaper/authors/hutchins.jpg',
    body: 'A bushel of corn sells for the same price whether it goes to a legal cornmeal mill or an illegal still. The farmer who grew it sleeps equally well in either case. The crusade against spirits has not reduced the acreage devoted to grain in this country by so much as a single row. The only change is that the government no longer collects a tax on the transaction. This seems, on reflection, to be the government\'s problem rather than mine.',
  },
  {
    id: 'opinion-naacp',
    type: 'opinion', year: 0, size: 'feature',
    headline: 'PROHIBITION ENFORCEMENT IN THE SOUTH IS NOT BLIND — IT SEES VERY WELL',
    author: 'James R. Calloway, Special Correspondent',
    authorImageUrl: '/newspaper/authors/calloway.jpg',
    subheadline: 'By a Correspondent Who Prefers Not to Be Named',
    body: 'Federal Prohibition agents in the former Confederate states exercise a discretion in enforcement that this correspondent does not find accidental. White establishments in Atlanta, Birmingham, and Memphis operate with notable impunity, while Negro-owned establishments and individuals are pursued with exemplary vigor. If the noble experiment is to be conducted, let it be conducted equally. The Volstead Act does not mention race; its enforcers seem to have supplied that omission themselves.',
  },
  {
    id: 'opinion-socialite',
    type: 'opinion', year: 0, size: 'brief',
    headline: 'WE SPENT $40,000 ON A BALL LAST SATURDAY; THE CHAMPAGNE WAS FRENCH AND THE LAWS WERE AMERICAN',
    author: 'Flora B. Carrington, Society & Culture Desk',
    authorImageUrl: '/newspaper/authors/carrington.jpg',
    body: 'The men and women who legislated this country dry have not themselves stopped drinking. They have simply moved their drinking from establishments where any citizen might observe them to private clubs and country houses where only the correct sort of people are invited. If Prohibition has achieved one thing, it is to make the consumption of spirits an upper-class privilege in fact as well as in price.',
  },
  {
    id: 'opinion-clergyman',
    type: 'opinion', year: 0, size: 'brief',
    headline: 'I PRAYED FOR PROHIBITION. I NOW PRAY IT WILL END.',
    author: 'Rev. Harlan B. Gould, First Baptist Church of Macon',
    authorImageUrl: '/newspaper/authors/gould.jpg',
    body: 'I was among the clergymen who testified before Congress in support of the Eighteenth Amendment. I believed, in my heart, that a dry America would be a more godly America. I was wrong. What we have produced is not sobriety but hypocrisy; not temperance but contempt for law itself. The man who breaks the Volstead Act tonight will break another law tomorrow with a cleaner conscience, having learned that some laws are merely other men\'s preferences written down.',
  },

  // ── ADVERTISEMENTS ────────────────────────────────────────────────────────

  {
    id: 'ad-grape-brick',
    type: 'ad', year: 0, size: 'brief',
    headline: 'VINE-GLO — THE GRAPE CONCENTRATE OF DISTINCTION',
    imageUrl: '/newspaper/ads/grape_brick.jpg',
    body: 'From California\'s finest vineyards! Dissolve one brick in one gallon of water. Your "juice" will be ready in 60 days. NOTE: Do not place in warm location — fermentation may result, which would be ILLEGAL under Federal law. Available in Port, Virginia Dare, Burgundy, Claret, Tokay. $1.50 per brick. CALIFORNIA VINEYARDISTS ASSOCIATION, Los Angeles.',
  },
  {
    id: 'ad-near-beer',
    type: 'ad', year: 0, size: 'brief',
    headline: 'BEVO — THE ALL-YEAR-ROUND BEVERAGE',
    imageUrl: '/newspaper/ads/near_beer.jpg',
    body: 'Anheuser-Busch\'s famous BEVO contains less than one-half of one percent alcohol — perfectly legal and perfectly refreshing. The same quality grain, the same Budweiser yeast, the same careful brewing. Available at all respectable grocers and drug stores. "The beverage that satisfies." ANHEUSER-BUSCH, St. Louis, Missouri.',
  },
  {
    id: 'ad-sears-radio',
    type: 'ad', year: 0, size: 'brief',
    headline: 'SILVERTONE RADIO RECEIVERS — HEAR THE WORLD FROM YOUR PARLOR',
    imageUrl: '/newspaper/ads/radio.jpg',
    body: 'The new SILVERTONE Model 6 brings you crystal-clear reception from stations as far as 500 miles distant. No aerial required. Complete with tubes, batteries, and headphones. $24.95 at your Sears, Roebuck & Company catalogue or store. SEARS, ROEBUCK & COMPANY, Chicago, Illinois.',
  },
  {
    id: 'ad-ford-model-t',
    type: 'ad', year: 0, size: 'brief',
    headline: 'THE FORD — A DEPENDABLE COMPANION FOR EVERY ROAD',
    imageUrl: '/newspaper/ads/model_t.jpg',
    body: 'No machine in the world has served more American families, farmers, and tradesmen than the Ford Motor Car. Built tough, maintained easily, priced within every working man\'s reach. The Ford is available at your nearest dealer. Prices start at $290. FORD MOTOR COMPANY, Dearborn, Michigan.',
  },
  {
    id: 'ad-wrigleys',
    type: 'ad', year: 0, size: 'brief',
    headline: 'WRIGLEY\'S SPEARMINT — AFTER EVERY MEAL',
    imageUrl: '/newspaper/ads/wrigleys.jpg',
    body: 'Dentists recommend it. Millions enjoy it. WRIGLEY\'S SPEARMINT GUM freshens breath, aids digestion, and satisfies the desire for something sweet without the dangers of strong drink. Five sticks for five cents. WRIGLEY COMPANY, Chicago.',
  },
  {
    id: 'ad-coca-cola',
    type: 'ad', year: 0, size: 'brief',
    headline: 'THE PAUSE THAT REFRESHES',
    imageUrl: '/newspaper/ads/coca_cola.jpg',
    body: 'When thirst calls — and it will — answer it with ice-cold COCA-COLA. Delicious, invigorating, and always wholesome. Available at every soda fountain and drug store across America. Five cents. THE COCA-COLA COMPANY, Atlanta, Georgia.',
  },
  {
    id: 'ad-malt-extract',
    type: 'ad', year: 0, size: 'brief',
    headline: 'PURITAN MALT EXTRACT — FOR BAKING AND HOME COOKING',
    imageUrl: '/newspaper/ads/malt_extract.jpg',
    body: 'PURITAN Malt Extract is the indispensable pantry staple for bread-making, cakes, and wholesome home cooking. Rich in vitamins. One pound tins, $0.35. NOTE FROM MANUFACTURER: Customers should be aware that PURITAN Malt Extract is strictly a cooking ingredient. Any accidental fermentation resulting from improper storage is the responsibility of the purchaser. PURITAN PRODUCTS, Milwaukee.',
  },
  {
    id: 'ad-packard',
    type: 'ad', year: 0, size: 'brief',
    headline: 'ASK THE MAN WHO OWNS ONE',
    imageUrl: '/newspaper/ads/packard.jpg',
    body: 'The PACKARD Motor Car requires no advertisement beyond its owner\'s satisfaction. Smooth, powerful, and built with a craftsman\'s care. The choice of presidents, industrialists, and men of discernment everywhere. PACKARD MOTOR CAR COMPANY, Detroit, Michigan. Prices upon application.',
  },
  {
    id: 'ad-dr-pepper',
    type: 'ad', year: 0, size: 'brief',
    headline: 'DRINK A BITE TO EAT AT 10, 2, AND 4 O\'CLOCK',
    imageUrl: '/newspaper/ads/dr_pepper.jpg',
    body: 'DR PEPPER, the friendly Pepper-Upper! Three times daily, millions of Americans enjoy the unique, refreshing taste that can\'t be described — only experienced. Sold at fountains everywhere. THE DR PEPPER COMPANY, Dallas, Texas.',
  },
  {
    id: 'ad-victrola',
    type: 'ad', year: 0, size: 'brief',
    headline: 'THE VICTOR VICTROLA BRINGS THE CONCERT HALL HOME',
    imageUrl: '/newspaper/ads/victrola.jpg',
    body: 'Why go out for entertainment when Caruso, Sousa, and all the great artists of the age will perform for you in your own parlor? The new VICTOR VICTROLA with orthophonic sound reproduction faithfully captures every note. Models from $25. RCA VICTOR, Camden, New Jersey.',
  },
  {
    id: 'ad-lucky-strike',
    type: 'ad', year: 0, size: 'brief',
    headline: 'REACH FOR A LUCKY INSTEAD OF A SWEET',
    imageUrl: '/newspaper/ads/lucky_strike.jpg',
    body: 'Modern science has determined that LUCKY STRIKE cigarettes are endorsed by 20,679 physicians for their throat-protecting toasted tobacco. "It\'s Toasted" — that\'s the Lucky Strike difference. When temptation calls, reach for a Lucky. AMERICAN TOBACCO COMPANY.',
  },
  {
    id: 'ad-patent-medicine',
    type: 'ad', year: 0, size: 'brief',
    headline: 'DR. HINKLEY\'S CELEBRATED SOOTHING TONIC — PRESCRIBED FOR WHAT AILS YOU',
    imageUrl: '/newspaper/ads/patent_medicine.jpg',
    body: 'For nervous complaints, ladies\' troubles, dyspepsia, and general debility, nothing equals DR. HINKLEY\'S CELEBRATED SOOTHING TONIC. Contains 14% grain spirits (for medicinal purposes only, pursuant to valid prescription). Available at authorized dispensaries. $1.00 per bottle. HINKLEY PHARMACEUTICAL, Cincinnati, Ohio.',
  },
  {
    id: 'ad-buick',
    type: 'ad', year: 0, size: 'brief',
    headline: 'WHEN BETTER AUTOMOBILES ARE BUILT, BUICK WILL BUILD THEM',
    imageUrl: '/newspaper/ads/buick.jpg',
    body: 'The 1924 BUICK Six-Cylinder Touring Car sets a new standard for smooth motoring on city street and country road alike. Self-starter, demountable rims, and all-weather top included. Proven in 10,000 miles of American road under all conditions. See your local BUICK dealer. BUICK MOTOR COMPANY, Flint, Michigan.',
  },
  {
    id: 'ad-fleischmanns-yeast',
    type: 'ad', year: 0, size: 'brief',
    headline: 'FLEISCHMANN\'S YEAST — FOR HEALTH, VITALITY, AND WHOLESOME HOME BAKING',
    imageUrl: '/newspaper/ads/fleischmanns.jpg',
    body: 'Two cakes of FLEISCHMANN\'S Yeast daily, dissolved in water and taken before meals, aids digestion, clears the complexion, and promotes robust vitality. Millions of satisfied users attest to its remarkable healthful properties. Also indispensable for the serious home baker. Available at all grocers. FLEISCHMANN\'S YEAST COMPANY, Cincinnati, Ohio.',
  },
  {
    id: 'ad-kodak',
    type: 'ad', year: 0, size: 'brief',
    headline: 'YOU PRESS THE BUTTON — WE DO THE REST',
    imageUrl: '/newspaper/ads/kodak.jpg',
    body: 'Record your happiest moments with a KODAK. New folding models fit in a coat pocket. Film, developing, and printing all available through your druggist. Your memories deserve permanence. KODAK BROWNIE cameras from $2.00. EASTMAN KODAK COMPANY, Rochester, New York.',
  },
  {
    id: 'ad-hotel',
    type: 'ad', year: 0, size: 'brief',
    headline: 'THE PALMER HOUSE, CHICAGO — AMERICA\'S FINEST HOTEL ACCOMMODATION',
    imageUrl: '/newspaper/ads/palmer_house.jpg',
    body: 'Visiting the great city of Chicago? The celebrated PALMER HOUSE offers 2,268 rooms, a barbershop of unequaled splendor, seven restaurants, and — we are required to add — absolutely no spirits whatsoever in any public room. The Palmer House\'s private dining arrangements are beyond the scope of this advertisement. PALMER HOUSE HOTEL, State & Monroe Streets, Chicago.',
  },
  {
    id: 'ad-elgin-watch',
    type: 'ad', year: 0, size: 'brief',
    headline: 'THE ELGIN WATCH TELLS TIME WITH MILITARY PRECISION',
    imageUrl: '/newspaper/ads/elgin_watch.jpg',
    body: 'Trusted by railroadmen, surgeons, and businessmen who cannot afford to be wrong. The ELGIN seventeen-jewel movement is accurate to within thirty seconds per month. Gold-filled cases from $22.50. Your jeweler has them in stock. ELGIN NATIONAL WATCH COMPANY, Elgin, Illinois.',
  },
  {
    id: 'ad-tobacco-chew',
    type: 'ad', year: 0, size: 'brief',
    headline: 'MAIL POUCH TOBACCO — TREAT YOURSELF TO THE BEST',
    imageUrl: '/newspaper/ads/mail_pouch.jpg',
    body: 'The working man\'s companion since 1879. MAIL POUCH Chewing Tobacco is mild, clean, and satisfying. The fine-cut blend preferred by miners, farmers, and tradesmen who know quality. Ten cents per pouch. Painted on 18,000 barn sides across America for good reason. BLOCH BROTHERS TOBACCO CO., Wheeling, West Virginia.',
  },
  {
    id: 'ad-cream-of-wheat',
    type: 'ad', year: 0, size: 'brief',
    headline: 'CREAM OF WHEAT — THE SATISFYING BREAKFAST FOR THE MAN WHO WORKS',
    imageUrl: '/newspaper/ads/cream_of_wheat.jpg',
    body: 'No breakfast sets a man up for a long day\'s work like a bowl of steaming CREAM OF WHEAT. Ready in five minutes. Wholesome, digestible, and economical. The hot breakfast that requires no visit to a saloon for fortification. CREAM OF WHEAT CORPORATION, Minneapolis, Minnesota.',
  },
  {
    id: 'ad-chicago-tribune',
    type: 'ad', year: 0, size: 'brief',
    headline: 'THE CHICAGO TRIBUNE — THE WORLD\'S GREATEST NEWSPAPER',
    imageUrl: '/newspaper/ads/chicago_tribune.jpg',
    body: 'For complete coverage of city, national, and international news, the daily CHICAGO TRIBUNE has no equal in the Middle West. Comics. Sports. Society. Finance. Colonel McCormick\'s TRIBUNE reports what the other papers dare not print. Two cents daily. Eight cents Sunday. On sale everywhere.',
  },
  {
    id: 'ad-listerine',
    type: 'ad', year: 0, size: 'brief',
    headline: 'OFTEN A BRIDESMAID, NEVER A BRIDE — HAVE YOU CONSIDERED LISTERINE?',
    imageUrl: '/newspaper/ads/listerine.jpg',
    body: 'Social science has established that halitosis (unpleasant breath) is responsible for more lost opportunities in business and romance than any other single cause. LISTERINE Antiseptic Mouthwash eliminates the problem at its source. Used morning and evening, it will transform your social prospects with remarkable speed. $0.25 at all drug stores. LAMBERT PHARMACAL COMPANY, St. Louis.',
  },
  {
    id: 'ad-perfume',
    type: 'ad', year: 0, size: 'brief',
    headline: 'CHANEL NO. 5 — THE SCENT THAT ANNOUNCES A WOMAN OF DISTINCTION',
    imageUrl: '/newspaper/ads/chanel_no5.jpg',
    body: 'Mademoiselle Chanel\'s extraordinary creation has taken Paris, London, and now America by storm. The modern woman — sophisticated, independent, and perfectly at ease in the best speakeasies — knows that NO. 5 is the only perfume she needs. $3.50 per flacon. CHANEL, available through Lord & Taylor, Marshall Field\'s, and all leading department stores.',
  },
  {
    id: 'ad-classified-lessons',
    type: 'ad', year: 0, size: 'brief',
    headline: 'LEARN THE CHARLESTON IN THREE LESSONS — GUARANTEED',
    body: 'Miss HELEN DUPRÉ\'S School of Modern Dance, established 1921, offers individual and group instruction in the Charleston, Black Bottom, Foxtrot, and all modern ballroom dances. Morning, afternoon, and evening hours. Ladies admitted with male escort or alone. "Knowing how to dance has never been more important." 47 W. Monroe Street, Chicago. Phone: Central 8840.',
  },

  // ── WILD-CARD STORIES (year = 0, shown any time) ─────────────────────────

  {
    id: 'wildcard-moonshiners',
    type: 'news', year: 0, size: 'feature',
    headline: 'APPALACHIAN MOONSHINERS SUPPLY NORTHERN CITIES WITH UNTAXED SPIRITS',
    publishedDate: 'c. 1925',
    body: 'Revenue agents operating in the hills of Kentucky, Tennessee, and West Virginia report a thriving trade in illegally produced corn whiskey flowing northward to supply the speakeasies of Cincinnati, Pittsburgh, and New York. Mountain distillers, many of whom were producing whiskey for personal use long before Prohibition, have found a ready urban market. Some operations have grown to industrial scale, employing dozens and producing hundreds of gallons weekly.',
    imageUrl: '/newspaper/moonshine_still.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Moonshine',
  },
  {
    id: 'wildcard-woman-bootlegger',
    type: 'news', year: 0, size: 'feature',
    headline: 'AUTHORITIES REPORT WOMEN INCREASINGLY ACTIVE IN BOOTLEG TRADE',
    publishedDate: 'c. 1923',
    body: 'Federal Prohibition agents in several cities report an unexpected trend: women are increasingly active participants in the bootleg trade, both as operators of speakeasies and as distributors of illicit spirits. Agents note that female smugglers present particular difficulties, as the law restricts pat-down searches by male officers. One Chicago operative known as "The Duchess" is believed to have run a distribution network serving forty establishments on the North Side.',
    imageUrl: '/newspaper/gertrude_lythgoe.png',
    sourceUrl: 'https://en.wikipedia.org/wiki/Prohibition_in_the_United_States',
  },
  {
    id: 'wildcard-bathtub-gin',
    type: 'news', year: 0, size: 'brief',
    headline: 'HEALTH BOARD WARNS OF DANGERS FROM IMPROPERLY MADE SPIRITS',
    publishedDate: 'c. 1926',
    body: 'The city Board of Health has issued an urgent warning against consuming homemade spirits of uncertain origin following six hospitalizations from methanol poisoning in the past week. Illicit gin produced from industrial alcohol stripped of its denaturants is particularly dangerous, the Board notes, as the process is imperfectly executed in most home operations. The Board urges citizens to abstain entirely — or at minimum, to know their distiller personally.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Bathtub_gin',
  },
  {
    id: 'wildcard-tunnel',
    type: 'news', year: 0, size: 'brief',
    headline: 'AGENTS DISCOVER 200-FOOT TUNNEL CONNECTING GARAGE TO SPEAKEASY',
    publishedDate: 'c. 1924',
    body: 'Prohibition agents raiding a garage on the West Side discovered a 200-foot tunnel lined with electric lights and equipped with a small hand-operated rail car for transporting cases of whiskey. The tunnel connected to the basement of a "soda parlor" three blocks away that had been in operation for two years. The owner of the soda parlor expressed complete surprise at the discovery.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Speakeasy',
  },
  {
    id: 'wildcard-ships',
    type: 'news', year: 0, size: 'brief',
    headline: 'BOOTLEG YACHT "EVENING STAR" OUTPACES COAST GUARD IN THREE-HOUR CHASE',
    publishedDate: 'c. 1923',
    body: 'The rumrunner Evening Star, believed to be carrying 800 cases of Canadian rye whiskey, eluded three Coast Guard cutters in a three-hour chase off the Jersey Shore before disappearing into a fog bank. The Evening Star, reportedly powered by a converted Liberty aircraft engine, is estimated to be capable of 42 knots. The Coast Guard is requesting an emergency appropriation for faster vessels.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Rum_Row',
  },
  {
    id: 'wildcard-npc-police',
    type: 'news', year: 0, size: 'brief',
    headline: 'GRAND JURY INDICTS EIGHT OFFICERS FOR ACCEPTING BOOTLEGGER BRIBES',
    publishedDate: 'c. 1927',
    body: 'A county grand jury has returned indictments against eight police officers for allegedly accepting monthly payments from bootlegging interests in exchange for advance notice of raids and protection from arrest. The district attorney\'s office said the investigation is continuing and that more indictments are expected. The police commissioner called the officers "a disgrace to the badge" while declining to comment on the investigation.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Prohibition_in_the_United_States',
  },
  {
    id: 'wildcard-supply-chain',
    type: 'news', year: 0, size: 'feature',
    headline: 'FROM STILL TO GLASS: THE REMARKABLE LOGISTICS OF ILLICIT SPIRITS',
    publishedDate: 'c. 1928',
    body: 'A bottle of whiskey purchased at a typical Chicago speakeasy may have begun its journey as grain in a Kentucky field, been distilled in a West Virginia hollow, transported by truck to Cincinnati, cut and bottled in a Detroit warehouse, moved across state lines hidden in crates of canned goods, and finally delivered to a North Side speakeasy in a dry-cleaning van. Each hand it passed through took a cut; by the time it reached the customer, a bottle that cost fifty cents to produce sold for three dollars. The markup, observers note, reflects the considerable overhead of staying out of prison.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Prohibition_in_the_United_States',
  },
  {
    id: 'wildcard-canada',
    type: 'news', year: 0, size: 'brief',
    headline: 'WINDSOR ONTARIO REPORTS EXPORT OF 900,000 GALLONS OF SPIRITS IN ONE MONTH',
    publishedDate: 'c. 1922',
    body: 'Customs records in Windsor, Ontario show that 900,000 gallons of spirits were legally exported from that city in a single month, ostensibly bound for Cuba and other international destinations. Investigators have noted that Cuba\'s annual legal spirits consumption is approximately 50,000 gallons. The discrepancy, one agent observed, could be explained by very thirsty Cubans or by the proximity of Detroit.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Rum-running',
  },
  {
    id: 'wildcard-jazz-club',
    type: 'news', year: 0, size: 'brief',
    headline: 'HARLEM COTTON CLUB PACKS 700 NIGHTLY; ELLINGTON ORCHESTRA THE DRAW',
    publishedDate: 'c. 1929',
    body: 'The Cotton Club on Lenox Avenue, operated under arrangements that have not been explained to the satisfaction of reformers, draws 700 customers nightly to hear Duke Ellington\'s orchestra play until dawn. The club serves no alcohol according to its management. Patrons arrive sober and depart, based on extensive observation, in a condition inconsistent with that claim.',
    imageUrl: '/newspaper/harlem_nightclub_map.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/Cotton_Club',
  },
  {
    id: 'wildcard-funny',
    type: 'news', year: 0, size: 'brief',
    headline: 'JUDGE FINES HIMSELF $10 AFTER ADMITTING HE DRANK BEER WHILE PRESIDING',
    publishedDate: 'c. 1924',
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

function pickTemplate<T>(templates: T[], seed: number): T {
  return templates[Math.abs(seed) % templates.length]
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
    const seed = msg.id

    let entry: Omit<ProhibitionStory, 'id' | 'type' | 'year' | 'size'> | null = null
    let key: string | null = null

    // ── Distillery Raid: 🥃 thiefName raided ... in cityName ... units of alcoholType ──
    if (text.includes('🥃') && text.toLowerCase().includes('raided')) {
      const cityMatch = text.match(/in\s+([A-Z][a-zA-Z\s]+?)(?:\s+and|\.|,|!|$)/)
      const city = cityMatch ? cityMatch[1].trim() : 'the City'
      const thief = text.match(/🥃\s+([^r]+?)\s+raided/)?.[1]?.trim() ?? 'an unknown party'
      const unitsMatch = text.match(/stole\s+(\d+)\s+units/)
      const units = unitsMatch ? unitsMatch[1] : 'several'
      const alcMatch = text.match(/units of\s+([a-zA-Z]+)/)
      const alc = alcMatch ? alcMatch[1] : 'spirits'
      key = `raid-${city}`
      const headline = pickTemplate([
        `FEDERAL AGENTS SMASH ILLICIT STILL IN ${city.toUpperCase()}`,
        `REVENUERS RAID HOOCH OPERATION IN ${city.toUpperCase()}`,
        `PROHIBITION BUREAU DESTROYS ${city.toUpperCase()} DISTILLERY`,
        `BOOZE BARONS SUFFER BLOW AS ${city.toUpperCase()} STILL IS DEMOLISHED`,
        `${city.toUpperCase()} MOONSHINE RING BUSTED BY TEMPERANCE AGENTS`,
      ], seed)
      const subheadline = pickTemplate([
        `${units} units of ${alc} seized; operator ${thief} sought for questioning`,
        `Authorities seize ${units} cases of illicit ${alc} from underground operation`,
        `${thief} reportedly fled the scene as agents moved in at dawn`,
        `Neighbors report explosion as copper stills were destroyed on premises`,
      ], seed + 1)
      const body = pickTemplate([
        `Federal prohibition agents descended upon a clandestine distillery in ${city} in the predawn hours, seizing ${units} units of ${alc} and reducing the apparatus to rubble. The operation, allegedly run by ${thief}, had reportedly supplied speakeasies across three counties. "We had received numerous complaints," said one agent who declined to be named. No arrests were made at the scene, though warrants are said to be forthcoming.`,
        `In a dramatic early-morning raid, agents of the Prohibition Bureau stormed a suspected illegal still operated by ${thief} on the outskirts of ${city}. Officers recovered ${units} cases of ${alc} and confiscated copper tubing, barrels of mash, and enough grain to fill a warehouse. Neighbors described hearing shouting and the clanging of metal before a plume of smoke rose over the rooftops. ${thief} was not present at the time of the raid.`,
        `The long arm of Prohibition enforcement reached into ${city} this week as federal agents dismantled a bootlegging operation said to produce hundreds of gallons of ${alc} per week. The still, traced to ${thief}, had evaded detection for months by operating under the guise of a legitimate grain storage facility. Authorities removed ${units} units and arrested two workers who refused to identify their employer.`,
        `Dry agents acting on a tip from an unnamed informant raided the ${city} headquarters of ${thief}, seizing ${units} units of untaxed ${alc} and making mincemeat of the illegal apparatus within. "This puts a considerable dent in the local liquor supply," declared the supervising agent. ${thief} is believed to have fled to a neighboring county and remains at large.`,
      ], seed + 2)
      entry = { headline, subheadline, body }

    // ── Arrest / Jail ──
    } else if (text.toLowerCase().includes('arrested') || text.toLowerCase().includes('jail')) {
      const nameMatch = text.match(/^([A-Za-z][A-Za-z\s'.]+?)\s+(?:was|has been|is)/)
      const name = nameMatch ? nameMatch[1].trim() : 'a Local Bootlegger'
      const cityMatch = text.match(/(?:in|at)\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|$)/)
      const city = cityMatch ? cityMatch[1].trim() : ''
      key = `arrest-${name}`
      const headline = pickTemplate([
        `${name.toUpperCase()} NABBED BY FEDS — SENTENCED TO THE HOOSEGOW`,
        `NOTORIOUS BOOTLEGGER ${name.toUpperCase()} CLAPPED IN IRONS`,
        `FEDS COLLAR ${name.toUpperCase()} IN DRAMATIC MIDNIGHT RAID`,
        `${name.toUpperCase()} FACES JUDGE AFTER LIQUOR CHARGES FILED`,
        `PROHIBITION AGENTS HAUL IN ${name.toUpperCase()} ON BOOZE COUNTS`,
      ], seed)
      const subheadline = pickTemplate([
        city ? `Arrest made in ${city} following weeks of federal surveillance` : `Arrest made following weeks of federal surveillance`,
        `${name} pleads innocence; counsel vows appeal to higher court`,
        `Informant testimony said to have sealed the case against the accused`,
        `Bail set at $2,000; associates scramble to cover the sum`,
      ], seed + 1)
      const body = pickTemplate([
        `Federal marshals apprehended ${name}${city ? ' in ' + city : ''} late Tuesday evening following a months-long investigation into the illegal liquor trade. The arrest, celebrated by temperance organizations citywide, brings to a close a chapter of brazen lawbreaking that authorities say cost the government untold sums in lost tax revenue. ${name} was taken to the federal building for processing and is expected to appear before a magistrate by week's end.`,
        `In what law enforcement officials are calling a significant blow to organized bootlegging, ${name} was taken into custody${city ? ' in ' + city : ''} on charges of manufacturing, transporting, and distributing intoxicating beverages in violation of the Volstead Act. Witnesses at the scene reported that ${name} offered no resistance but was heard to mutter colorful remarks in the direction of the arresting officers. Trial is set for the spring docket.`,
        `The storied criminal career of ${name} came to an abrupt halt this week when prohibition agents, armed with sworn warrants, arrived at the suspect's known address${city ? ' in ' + city : ''} and effected an arrest without incident. Sources close to the investigation say the evidence against ${name} is formidable, including ledger books, witness statements, and no fewer than forty gallons of untaxed spirits discovered on the premises.`,
        `${name} has been committed to the county jail${city ? ' in ' + city : ''} pending trial on multiple counts of Volstead Act violations, following an arrest that sent ripples through the local underworld. Those who knew ${name} expressed varying degrees of surprise — few believed the law would catch up so quickly. Defense counsel is expected to argue entrapment, a strategy that has met with mixed success in the federal courts.`,
      ], seed + 2)
      entry = { headline, subheadline, body }

    // ── Territory Claim ──
    } else if (text.toLowerCase().includes('claimed') || text.toLowerCase().includes('took over')) {
      const cityMatch = text.match(/(?:claimed|took over)\s+([A-Z][a-zA-Z\s]+?)(?:\s+territory|\s|,|\.|$)/)
      const city = cityMatch ? cityMatch[1].trim() : 'a Disputed City'
      const claimerMatch = text.match(/^([A-Za-z][A-Za-z\s'.]+?)\s+(?:claimed|took over)/)
      const claimer = claimerMatch ? claimerMatch[1].trim() : 'an ambitious operator'
      key = `claim-${city}`
      const headline = pickTemplate([
        `${city.toUpperCase()} TERRITORY CHANGES HANDS IN BOLD POWER PLAY`,
        `UNDERWORLD SHAKEUP: ${claimer.toUpperCase()} SEIZES ${city.toUpperCase()}`,
        `${city.toUpperCase()} NOW UNDER NEW MANAGEMENT, SOURCES SAY`,
        `BRAZEN TAKEOVER RESHUFFLES CRIME MAP IN ${city.toUpperCase()}`,
        `${claimer.toUpperCase()} PLANTS FLAG IN ${city.toUpperCase()} AS RIVALS SCATTER`,
      ], seed)
      const subheadline = pickTemplate([
        `${claimer} consolidates grip on ${city} distribution routes`,
        `Former operators reportedly fled rather than contest the claim`,
        `Local merchants brace for shakedowns as new boss settles in`,
        `Territorial lines redrawn overnight; police claim ignorance`,
      ], seed + 1)
      const body = pickTemplate([
        `The criminal landscape of ${city} was redrawn this week as ${claimer} moved decisively to claim the city's lucrative bootlegging territory, forcing out the previous operators with a combination of persuasion and menace. Shopkeepers along the main thoroughfare reported unusual activity in the early hours, including trucks moving crates and stern-faced men in overcoats conducting what appeared to be a census of the local establishments. "I don't ask questions," said one cigar-store owner.`,
        `${claimer} has consolidated control over ${city}, according to sources familiar with the region's underground economy, following a rapid and largely bloodless takeover that left the previous power structure in disarray. Those who had paid protection to the prior organization now find themselves re-negotiating terms with an entirely new set of representatives — and the new rates, rumor has it, are somewhat steeper.`,
        `In a move that surprised few observers of the illicit liquor trade, ${claimer} has established dominance over ${city} and its surrounding distribution network. The city's speakeasy owners, ever pragmatic, are said to have received the new arrangement with a minimum of complaint. "You serve whoever holds the keys," remarked a bartender who requested anonymity. Federal agents professed to have no knowledge of any change in local criminal governance.`,
        `${city} woke to a new order this week as ${claimer} completed an audacious campaign to wrest control of the city's bootlegging operations from entrenched rivals. The transition, accomplished over the course of a single turbulent evening, saw several of the old guard escorted to the city limits and advised not to return. ${claimer} is now said to command a network of drivers, lookouts, and silent partners stretching from the city center to the county line.`,
      ], seed + 2)
      entry = { headline, subheadline, body }

    // ── Toll Payment: 💰 victimName paid ownerName a $amount toll for passing through city ──
    } else if (text.includes('💰') && text.toLowerCase().includes('toll')) {
      const m = text.match(/💰\s+(.+?)\s+paid\s+(.+?)\s+a\s+\$?([\d,]+)\s+.*?through\s+([A-Z][a-zA-Z\s]+?)\./)
      const victim = m?.[1]?.trim() ?? 'a traveler'
      const owner = m?.[2]?.trim() ?? 'the city boss'
      const amount = m?.[3] ?? 'a handsome sum'
      const city = m?.[4]?.trim() ?? 'the City'
      key = `toll-${city}-${victim}`
      const headline = pickTemplate([
        `${city.toUpperCase()} TOLL ROADS ENRICHING CITY BOSSES`,
        `${owner.toUpperCase()} COLLECTS FAT TRIBUTE FROM ${victim.toUpperCase()}`,
        `ROAD TAXES MOUNT AS ${city.toUpperCase()} BOSS TIGHTENS GRIP`,
        `NO FREE PASSAGE IN ${city.toUpperCase()} — ${owner.toUpperCase()} DEMANDS DUES`,
        `${city.toUpperCase()} LOCALS CRY FOUL AS TOLL RACKET FLOURISHES`,
      ], seed)
      const subheadline = pickTemplate([
        `$${amount} changes hands; ${victim} reportedly none too pleased`,
        `${owner}'s coffers swell as ${city} routes remain closely guarded`,
        `Toll-payers say it beats the alternative; authorities look away`,
        `$${amount} extracted from ${victim} in exchange for safe passage`,
      ], seed + 1)
      const body = pickTemplate([
        `${victim} was compelled to part with $${amount} upon entering the territory of ${city}, controlled by ${owner}, in what the underground trade has come to call a "courtesy toll." The practice, widely condemned by those who must pay it and vigorously defended by those who collect, has become a fixture of inter-city bootlegging operations across the region. "It's either pay or find another road," shrugged one driver who has made the same payment three times this month.`,
        `The toll-collection racket run by ${owner} in ${city} claimed another victim this week as ${victim} surrendered $${amount} for the privilege of conducting business in the area. Critics decry the practice as outright extortion dressed in the language of commerce; supporters — chiefly ${owner} — describe it as reasonable compensation for maintaining order in a difficult trade. The local constabulary, when asked for comment, found themselves suddenly fascinated by paperwork.`,
        `Word reaches this desk that ${victim} paid $${amount} to ${owner} for passage through ${city}, adding another chapter to the ongoing saga of territorial taxation that has become the unofficial tariff system of the bootlegging world. Operators who balk at the fee have reportedly found their shipments delayed, diverted, or simply disappeared. Most, like ${victim}, conclude that the toll is the cheaper option by some measure.`,
        `${owner}'s revenue from territorial tolls reached another milestone this week as ${victim} contributed $${amount} to the ${city} boss's considerable treasury. The toll system, which ${owner} enforces with characteristic efficiency, has transformed the city's crossroads into a reliable income stream — one that law enforcement has been conspicuously unable to disrupt. "It's a tax," said one insider. "Just not the government's kind."`,
      ], seed + 2)
      entry = { headline, subheadline, body }

    // ── Betrayal: 🔥 player betrayed their alliance with ally ──
    } else if (text.includes('🔥') && text.toLowerCase().includes('betray')) {
      const m = text.match(/🔥\s+(.+?)\s+betrayed.*?with\s+(.+?)\.\s/)
      const betrayer = m?.[1]?.trim() ?? 'a disloyal operator'
      const betrayed = m?.[2]?.trim() ?? 'a former ally'
      key = `betrayal-${betrayer}-${betrayed}`
      const headline = pickTemplate([
        `SHOCKING BETRAYAL: ${betrayer.toUpperCase()} TURNS ON ${betrayed.toUpperCase()}`,
        `ALLIANCE IN RUINS AS ${betrayer.toUpperCase()} STABS PARTNER IN BACK`,
        `TREACHERY ROCKS UNDERWORLD — ${betrayer.toUpperCase()} DOUBLE-CROSSES ${betrayed.toUpperCase()}`,
        `NO HONOR AMONG BOOTLEGGERS: ${betrayer.toUpperCase()} SELLS OUT ${betrayed.toUpperCase()}`,
        `${betrayed.toUpperCase()} LEFT COLD AS ${betrayer.toUpperCase()} CUTS TIES`,
      ], seed)
      const subheadline = pickTemplate([
        `Former partners now enemies; associates choose sides`,
        `The heat is on as federal agencies probe the rift`,
        `${betrayed} vows retribution; ${betrayer} denies all wrongdoing`,
        `Underworld braces for fallout from stunning double-cross`,
      ], seed + 1)
      const body = pickTemplate([
        `The criminal partnership between ${betrayer} and ${betrayed}, long considered one of the more stable arrangements in the regional bootlegging trade, collapsed in spectacular fashion this week amid allegations of double-dealing that have set the underworld buzzing. ${betrayer} is said to have approached federal agents with information damaging to ${betrayed}'s operation — an act that the latter is unlikely to regard with equanimity. "In this business, trust is a luxury," observed one veteran of the trade.`,
        `${betrayer} has reportedly severed all ties with former ally ${betrayed}, in what insiders describe as the most consequential rupture in the local underworld in recent memory. The precise nature of the betrayal is not fully known, but sources indicate that ${betrayer} may have passed information — or simply stolen territory — at a moment of particular vulnerability for ${betrayed}. Reprisals are expected, and soon.`,
        `Loyalty, always in short supply in the bootlegging trade, proved altogether absent this week as ${betrayer} turned against ${betrayed} in a move that has shocked even the most cynical observers of underground commerce. Those who relied on the partnership for stable supply chains are now scrambling to secure new arrangements. The falling-out is said to have begun over a disputed shipment and escalated with remarkable speed into open hostility.`,
        `The phrase "honor among thieves" received another blow to its already battered reputation as ${betrayer} publicly — and with evident calculation — abandoned their arrangement with ${betrayed}. The split, attributed to a combination of greed and opportunity, has left ${betrayed} exposed on multiple fronts and ${betrayer} in possession of advantages that were not, strictly speaking, earned. The district's other operators are watching developments with close attention.`,
      ], seed + 2)
      entry = { headline, subheadline, body }

    // ── Cash Transfer: 💸 player transferred $amount to ally ──
    } else if (text.includes('💸') && text.toLowerCase().includes('transferred')) {
      const m = text.match(/💸\s+(.+?)\s+transferred\s+\$?([\d,]+)\s+to\s+(.+?)\./)
      const sender = m?.[1]?.trim() ?? 'a local operator'
      const amount = m?.[2] ?? 'a large sum'
      const recipient = m?.[3]?.trim() ?? 'an unknown party'
      key = `transfer-${sender}-${recipient}`
      const headline = pickTemplate([
        `${sender.toUpperCase()} MOVES $${amount} TO ${recipient.toUpperCase()} IN SHADOWY DEAL`,
        `UNDERGROUND BANK: ${sender.toUpperCase()} BANKROLLS ${recipient.toUpperCase()}`,
        `MYSTERIOUS CASH TRANSFER BETWEEN ${sender.toUpperCase()} AND ${recipient.toUpperCase()}`,
        `${sender.toUpperCase()} CUTS ${recipient.toUpperCase()} A SHARE OF ILLICIT PROFITS`,
        `MONEY MOVES: ${amount} DOLLARS CHANGE HANDS IN SECRETIVE TRANSACTION`,
      ], seed)
      const subheadline = pickTemplate([
        `Transaction conducted in cash; no records kept, sources say`,
        `Purpose of the $${amount} payment remains unclear to authorities`,
        `${recipient} said to have received funds without explanation`,
        `Investigators have long sought to trace ${sender}'s financial dealings`,
      ], seed + 1)
      const body = pickTemplate([
        `A transfer of $${amount} from ${sender} to ${recipient} was confirmed by sources close to both parties, raising fresh questions about the financial entanglements of the region's bootlegging elite. Whether the payment represents a share of profits, a loan, a bribe, or something more sinister is unclear — those involved offered no explanation and declined all requests for comment. Federal accountants, who have long suspected the existence of such arrangements, are said to be scrutinizing their ledgers with renewed intensity.`,
        `${sender} is reported to have passed $${amount} to ${recipient} in a transaction that bypassed the banking system entirely and left no paper trail save the memories of those present. The underground economy's reliance on cash, while inconvenient for bookkeeping purposes, has made it notoriously difficult for revenue agents to track. "They keep it all in their heads," complained one frustrated investigator.`,
        `Word of a $${amount} payment from ${sender} to ${recipient} circulated through the underworld's informal telegraph this week, prompting speculation about the nature of the arrangement between the two operators. Business partners, silent investors, and protection payments are among the explanations being offered in various quarters. The principals are not talking, but those familiar with both parties suggest that the transaction is unlikely to be the last.`,
        `The financial relationship between ${sender} and ${recipient} entered a new chapter this week when $${amount} changed hands under circumstances that neither party has chosen to illuminate. In a world where a handshake is the only contract and the only court is the street, such transfers are both common and opaque. Federal investigators, long aware of ${sender}'s considerable liquid assets, are said to be less than satisfied with the available documentation.`,
      ], seed + 2)
      entry = { headline, subheadline, body }

    // ── Stash ──
    } else if (text.toLowerCase().includes('stashed') && !text.includes('💰')) {
      const cityMatch = text.match(/in\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|$)/)
      const city = cityMatch ? cityMatch[1].trim() : 'an undisclosed location'
      const playerMatch = text.match(/^([A-Za-z][A-Za-z\s'.]+?)\s+stashed/)
      const player = playerMatch ? playerMatch[1].trim() : 'an unknown party'
      key = `stash-${player}-${city}`
      const headline = pickTemplate([
        `SECRET CACHE DISCOVERED IN ${city.toUpperCase()} — OR IS IT?`,
        `${player.toUpperCase()} SECRETES GOODS IN ${city.toUpperCase()} HIDEOUT`,
        `BOOTLEGGER BURIES TREASURE IN ${city.toUpperCase()}`,
        `MYSTERIOUS STASH REPORTED IN ${city.toUpperCase()}`,
      ], seed)
      const subheadline = pickTemplate([
        `Location of the hidden cache known only to ${player}`,
        `Neighbors noticed unusual activity but kept their counsel`,
        `Feds seek informants; ${city} residents tight-lipped as ever`,
        `What was hidden — and why — remains anyone's guess`,
      ], seed + 1)
      const body = pickTemplate([
        `${player} was observed making arrangements in ${city} that veterans of the trade immediately recognized as the establishment of a clandestine stash — the bootlegger's version of a savings account, kept not in a bank vault but in basements, false walls, and sympathetic barns. The contents are unknown, but the very act of concealment speaks to the precarious nature of a trade in which a single unguarded shipment can mean financial ruin or federal prosecution.`,
        `Reliable sources report that ${player} has cached undisclosed goods somewhere in ${city}, a common precaution among those who move contraband across heavily watched territory. Whether the stash consists of cash, spirits, or some combination of the two is a matter of speculation. What is certain is that ${player} is not the first to use ${city} as a repository, and the city's reputation for discretion has been well earned.`,
      ], seed + 2)
      entry = { headline, subheadline, body }

    // ── Trap Triggered ──
    } else if (text.toLowerCase().includes('triggered a trap')) {
      const cityMatch = text.match(/in\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|$)/)
      const city = cityMatch ? cityMatch[1].trim() : 'the district'
      const playerMatch = text.match(/^([A-Za-z][A-Za-z\s'.]+?)\s+triggered/)
      const player = playerMatch ? playerMatch[1].trim() : 'a hapless operator'
      key = `trap-${player}-${city}`
      const headline = pickTemplate([
        `BOOTLEGGER WALKS INTO TRAP IN ${city.toUpperCase()}`,
        `${player.toUpperCase()} SPRINGS RIVAL'S AMBUSH IN ${city.toUpperCase()}`,
        `CUNNING SNARE CATCHES ${player.toUpperCase()} FLAT-FOOTED IN ${city.toUpperCase()}`,
        `TREACHERY AFOOT: ${player.toUpperCase()} FALLS FOR SETUP IN ${city.toUpperCase()}`,
      ], seed)
      const subheadline = pickTemplate([
        `${player} reportedly unaware of the trap until it was too late`,
        `The cunning of the setup has the underworld talking`,
        `A rival's patience, it seems, was finally rewarded`,
        `Damage to ${player}'s operation still being assessed`,
      ], seed + 1)
      const body = pickTemplate([
        `${player} walked into a carefully laid trap in ${city} this week, falling prey to a scheme that those familiar with the local underworld say had been weeks in the making. The precise nature of the trap — whether ambush, false tip, or rigged deal — was not immediately clear, but the consequences for ${player}'s operations are said to be considerable. "You've got to watch every shadow in this business," observed one veteran operator. "And some of the shadows are watching back."`,
        `The underworld's appetite for treachery was amply satisfied in ${city} this week as ${player} triggered a rival's elaborate trap and found themselves suddenly and painfully disadvantaged. Sources describe the setup as patient, meticulous, and devastatingly effective — the work of someone who had studied ${player}'s habits over a long period. The identity of the trap-setter is not confirmed, but the shortlist of suspects is said to be short indeed.`,
      ], seed + 2)
      entry = { headline, subheadline, body }
    }

    if (entry && key && !seen.has(key)) {
      seen.add(key)
      results.push({
        id: `game-event-${msg.id}`,
        type: 'news',
        year,
        size: 'brief',
        ...entry,
      })
    }
  }

  return results
}
