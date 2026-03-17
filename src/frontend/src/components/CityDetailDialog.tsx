import React from 'react'

const CITY_DESCRIPTIONS: Record<string, string> = {
  'Chicago': "Al Capone's Chicago Outfit turned this city into the bootlegging capital of America. Tunnels beneath the streets connected speakeasies to breweries, and corrupt cops looked the other way for a cut of the take.",
  'New York City': "Home to over 30,000 speakeasies by the late 1920s, New York laughed at Prohibition. From Harlem jazz clubs to Greenwich Village dives, the city never stopped drinking — it just moved underground.",
  'Detroit': "Sitting across the river from Windsor, Ontario, Detroit became the busiest smuggling corridor in North America. At its peak, the 'Windsor Funnel' funnelled half of all Canadian liquor entering the United States.",
  'New Orleans': "Prohibition never really stuck in New Orleans. The city's deep French and Creole drinking traditions, combined with a police force more interested in bribes than arrests, made it the wettest city in the dry South.",
  'San Francisco': "Ships from Canada, Mexico, and the Pacific Islands unloaded contraband spirits into the fog-shrouded docks of the Embarcadero. Chinese tongs controlled much of the underground distribution network.",
  'St. Louis': "Once America's premier brewing city, St. Louis went underground when Prohibition hit. The same vast cellars that aged Budweiser now hid tens of thousands of barrels of near-beer and stronger stuff.",
  'Miami': "Florida's warm waters and proximity to the Caribbean made Miami the front door for rum runners. Speedboats loaded with Bahamian rum could make the crossing in a single night, outrunning any Coast Guard cutter.",
  'Seattle': "The Puget Sound's maze of islands, inlets, and fog banks made it paradise for smugglers. Canadian whiskey flowed south through fishing boats and float planes, and Seattle's police largely let it happen.",
  'Galveston': "Dubbed the 'Free State of Galveston,' the island city operated openly under the Maceo crime family. Hotel ballrooms served cocktails to tourists while the Texas Rangers were paid to stay on the mainland.",
  'Atlantic City': "Nucky Johnson ruled Atlantic City like a personal fiefdom. Bootleg liquor flowed freely in the resort hotels, and the annual gangster conventions held here shaped the national organized crime landscape.",
  'Buffalo': "A stone's throw from Canada across Lake Erie, Buffalo was a natural transit hub for smuggled Canadian whiskey. By 1929 bootlegging had become the city's second-largest industry.",
  'Mobile': "Mobile's quiet Gulf harbor and maze of bayous made it a preferred landing point for rum runners from Cuba and the Caribbean. Local fishermen supplemented their income guiding liquor boats to shore.",
  'San Diego': "Just miles from the Baja California border, San Diego became the principal entry point for Mexican tequila and mezcal. Tijuana's thriving saloon trade was visible from the American side.",
  'Savannah': "Savannah's deep-water port and tangle of coastal waterways made it ideal for offloading Caribbean rum from ocean-going vessels. The city's old-money families quietly kept their cellars well stocked.",
  'Cleveland': "Cleveland's Lake Erie shoreline, close to Canadian shores at Pelee Island, earned it the nickname 'Speedboat Alley.' The Mayfield Road Mob controlled the lake trade and built a criminal empire from it.",
  'Duluth': "The remote forests and lakes of northern Minnesota provided cover for a sprawling moonshine industry. Duluth served as the commercial hub where timber-country stills met Great Lakes shipping routes.",
  'Blackfoot': "An unlikely outpost in the Idaho high desert, Blackfoot sat on a remote rail junction that made it a persistent, if quiet, waypoint for spirits moving between the Pacific Northwest and the Mountain West.",
  'Bristol': "Straddling the Tennessee-Virginia border, Bristol sat in the heart of moonshine country. The surrounding Appalachian hollows were dotted with copper stills, and Bristol's rail yards moved the product north.",
  'Louisville': "Kentucky's bourbon distilleries received special federal permits to produce 'medicinal whiskey,' and Louisville's doctors wrote prescriptions by the thousand. It was the most medicated city in America.",
  'Kansas City': "Boss Tom Pendergast ran Kansas City as an open city — gambling, prostitution, and booze flowed freely under his political machine. It was said you could get a drink on any corner in Kansas City.",
  'Chattanooga': "Nestled in the Appalachians at a major rail junction, Chattanooga was the shipping nerve centre for moonshine coming down from the Tennessee and Georgia mountains into the broader distribution network.",
  'Milwaukee': "Milwaukee's German immigrant brewers refused to go quietly. The great brewing families converted their operations to 'near beer' publicly while continuing full-strength production in hidden sub-basements.",
  'Peoria': "Before Prohibition, Peoria distilled more whiskey than anywhere else in America. Its underground networks were so entrenched that federal agents coined the phrase 'Will it play in Peoria?' for any enforcement plan.",
  'Hot Springs': "The spa town of Hot Springs operated as a neutral zone where rival gang leaders from across the country could meet, deal, and relax without fear of violence — or arrest, thanks to a thoroughly bought police force.",
  'Nashville': "A critical distribution hub for the Southeast, Nashville's rail connections allowed moonshine from the surrounding hill country to reach cities from Atlanta to Chicago with a single freight transfer.",
  'Des Moines': "The small town of Templeton, Iowa became legendary for its Templeton Rye, which Al Capone reportedly made his house whiskey. Des Moines served as the commercial and logistics centre for Iowa's underground trade.",
  'Cincinnati': "Sitting on the Ohio River at the edge of Kentucky bourbon country, Cincinnati built a reputation as a bootlegger's paradise. The city's intricate network of hilltop tunnels and river warehouses moved product day and night.",
  'Pittsburgh': "Steel workers demanded beer, and Pittsburgh's industrial bosses were happy to oblige. The city's ethnic neighborhoods — Polish, Slovak, Italian — each operated their own underground brewing operations.",
  'Atlanta': "Atlanta's position as the South's rail crossroads made it the natural distribution centre for bootleg spirits moving from Gulf ports and Appalachian stills to cities across the Southeast.",
  'Denver': "Perched in the Rocky Mountains, Denver controlled the mountain passes through which liquor moved between the coasts. Ski lodges and mining camps alike maintained a brisk trade in contraband spirits.",
  'Omaha': "Dubbed the 'Mini-Chicago' of the Plains, Omaha had its own organized crime syndicate, its own network of speakeasies, and a stockyards workforce that demanded steady access to cheap beer and spirits.",
  'Salt Lake City': "The supreme irony: Utah's Mormon capital sat on a desert transit corridor that made it unavoidable for liquor shipments moving between California and the Midwest. Bootleggers quietly worked around the piety.",
  'Albuquerque': "The ancient trade routes through New Mexico became liquor corridors during Prohibition. Albuquerque's position on the Santa Fe Railway made it a natural waypoint for tequila moving north from the Mexican border.",
  'Memphis': "Sitting on the Mississippi River, Memphis had a long tradition of riverboat commerce that adapted naturally to the liquor trade. Blues clubs in the Beale Street district never closed — they just drew the curtains.",
  'Indianapolis': "Indiana's road and rail hub made Indianapolis an essential node for bootleg distribution across the Midwest. Truck convoys carrying 'farm supplies' were a common sight on the roads radiating out of the city.",
  'Phoenix': "The harsh Sonoran Desert made Phoenix a natural waypoint for convoys ferrying tequila north from the Mexican border. Roadside motor courts rented rooms by the hour and asked no questions about cargo.",
  'Philadelphia': "Ironically, Philadelphia had one of the most aggressive bootlegging operations in the country despite public claims of being a 'clean' city. Mayor Kendrick famously said he never touched the stuff — his associates did.",
  'Washington DC': "The 'Green Hat' federal prohibition agents were the most notorious in the country, but Washington's political class ensured the city's private clubs and embassies remained well stocked throughout the dry years.",
  'Baltimore': "Baltimore's seafaring culture and defiant independent streak made it openly hostile to Prohibition enforcement. H.L. Mencken wrote gleefully about his home city's resistance to what he called 'Puritanical lunacy.'",
  'Los Angeles': "Hollywood's boom years coincided with Prohibition, and the movie colony's legendary parties required an endless supply of bootleg spirits. Rumrunners offloaded Canadian whiskey in the canyons above Malibu.",
  'Newark': "Abner 'Longy' Zwillman built a bootlegging empire from Newark that rivalled the New York families. His distribution network stretched across New Jersey and deep into New England.",
  'Boston': "The Kennedy family fortune was built, in part, on the liquor trade — a fact Joseph P. Kennedy was careful never to confirm. Boston's Irish political machine ensured that enforcement remained strictly theatrical.",
  'Minneapolis': "Minnesota's long, cold winters created both a thirsty population and ideal storage conditions for distilled spirits. The city's Scandinavian immigrant community developed a particularly potent tradition of home distilling.",
  'Fort Worth': "Known as 'Hell's Half Acre' even before Prohibition, Fort Worth's Jacksboro Highway strip became legendary for illegal roadhouses. Texas Rangers raided them weekly and bootleggers reopened them the next day.",
  'Portland': "Portland's infamous Shanghai Tunnels, built to spirit sailors to waiting ships, found new purpose during Prohibition as smuggling corridors for Canadian whiskey moving down from British Columbia.",
  'Oklahoma City': "Oklahoma went completely dry even before national Prohibition — yet bootlegging flourished. The state's thousands of miles of back roads made enforcement impossible and moonshining a cottage industry.",
  'Little Rock': "Arkansas's political fixers earned a reputation as the most accommodating in the South. Little Rock's courthouse crowd could make any shipment of contraband disappear — for a modest political contribution.",
  'Richmond': "The Piedmont region of Virginia harboured a centuries-old tradition of small-scale distilling. Richmond served as the marketing and distribution hub for mountain stills whose output was prized across the East Coast.",
  'Providence': "Rhode Island's tiny size belied its outsized defiance of Prohibition. Providence's compact waterfront made liquor offloading quick and easy, and the city's Mafia connections ensured smooth distribution north into New England.",
  'Las Vegas': "In 1920, Las Vegas was barely a desert railroad stop — but its remote location and minimal law enforcement made it an attractive base for bootleggers working the Southwest. The vice frontier was just getting started.",
}

interface CityDetailDialogProps {
  cityName: string
  populationTier: string
  primaryAlcohol: string
  ownerName: string | null
  ownerColor: string | null
  onClose: () => void
}

export default function CityDetailDialog({
  cityName, populationTier, primaryAlcohol, ownerName, ownerColor, onClose
}: CityDetailDialogProps) {
  const description = CITY_DESCRIPTIONS[cityName] ?? 'A city that played its part in the underground trade during the Prohibition years.'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />

      <div className="relative bg-stone-900 border border-stone-600 rounded-lg shadow-2xl w-[480px] max-h-[85vh] flex flex-col overflow-hidden">

        {/* City image */}
        <div className="relative h-56 bg-stone-950 flex-shrink-0 overflow-hidden">
          <img
            src={`/cities/${cityName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}.png`}
            alt={cityName}
            className="w-full h-full object-cover"
            style={{ filter: 'sepia(0.25) contrast(1.05) brightness(0.9)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white/70 hover:text-white text-xl leading-none drop-shadow"
          >✕</button>
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-stone-900 to-transparent" />
        </div>

        {/* Content */}
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wider mb-0.5">
              {populationTier} · {primaryAlcohol}
            </p>
            <h2 className="text-2xl font-bold text-amber-300">{cityName}</h2>
          </div>

          {ownerName && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ownerColor ?? '#888' }} />
              <span style={{ color: ownerColor ?? '#888' }} className="font-semibold">
                Controlled by {ownerName}
              </span>
            </div>
          )}

          <p className="text-stone-300 text-sm leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  )
}
