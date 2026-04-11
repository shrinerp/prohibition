import React, { useState } from 'react'
import { Link } from 'react-router-dom'

// ── Section component ────────────────────────────────────────────────────────
function Section({ id, title, emoji, children }: { id: string; title: string; emoji: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="flex items-center gap-3 text-xl font-black text-amber-400 mb-4 pb-2 border-b border-stone-700">
        <span className="text-2xl">{emoji}</span>
        {title}
      </h2>
      <div className="space-y-3 text-stone-300 text-sm leading-relaxed">
        {children}
      </div>
    </section>
  )
}

function Rule({ children }: { children: React.ReactNode }) {
  return <p className="pl-3 border-l-2 border-stone-700">{children}</p>
}

function Callout({ children, color = 'amber' }: { children: React.ReactNode; color?: 'amber' | 'red' | 'green' | 'blue' }) {
  const styles = {
    amber: 'bg-amber-950/40 border-amber-700 text-amber-200',
    red:   'bg-red-950/40  border-red-800   text-red-200',
    green: 'bg-green-950/40 border-green-800 text-green-200',
    blue:  'bg-blue-950/40  border-blue-800  text-blue-200',
  }
  return (
    <div className={`border rounded-lg px-4 py-3 text-sm ${styles[color]}`}>
      {children}
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1 border-b border-stone-800 last:border-0">
      <span className="text-stone-400 text-xs uppercase tracking-wider">{label}</span>
      <span className="text-stone-200 text-sm font-semibold tabular-nums">{value}</span>
    </div>
  )
}

// ── Nav links ────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'overview',   label: 'Overview' },
  { id: 'turns',      label: 'Turns' },
  { id: 'distillery', label: 'Distilleries' },
  { id: 'market',     label: 'Market' },
  { id: 'vehicles',   label: 'Vehicles' },
  { id: 'heat',       label: 'Heat & Police' },
  { id: 'territory',  label: 'Territory' },
  { id: 'missions',   label: 'Missions' },
  { id: 'bribe',      label: 'Bribes' },
  { id: 'traps',      label: 'Traps' },
  { id: 'alliances',  label: 'Alliances' },
  { id: 'characters', label: 'Characters' },
  { id: 'winning',    label: 'Winning' },
]

export default function HowToPlayPage() {
  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className="min-h-screen bg-stone-950 text-amber-100">

      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-stone-900/95 backdrop-blur border-b border-stone-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <img src="/logo.png" alt="Prohibitioner" className="h-8 w-auto group-hover:opacity-80 transition" />
          </Link>
          <span className="text-stone-600 text-sm hidden sm:block">/</span>
          <span className="text-amber-400 font-bold text-sm hidden sm:block">How to Play</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setNavOpen(o => !o)}
            className="sm:hidden px-3 py-1.5 text-xs bg-stone-800 border border-stone-600 rounded text-stone-300"
          >
            {navOpen ? 'Close' : 'Sections ▾'}
          </button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {navOpen && (
        <div className="sm:hidden bg-stone-900 border-b border-stone-800 px-4 py-3 grid grid-cols-2 gap-1">
          {NAV.map(n => (
            <a
              key={n.id}
              href={`#${n.id}`}
              onClick={() => setNavOpen(false)}
              className="text-stone-400 hover:text-amber-400 text-xs py-1 transition"
            >
              {n.label}
            </a>
          ))}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-10 flex gap-10">

        {/* Sidebar nav — desktop */}
        <aside className="hidden sm:block w-44 flex-shrink-0">
          <div className="sticky top-24 space-y-0.5">
            <p className="text-xs text-stone-600 uppercase tracking-widest mb-3">Contents</p>
            {NAV.map(n => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className="block text-stone-500 hover:text-amber-400 text-sm py-1 transition"
              >
                {n.label}
              </a>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-12">

          {/* Hero */}
          <div className="text-center py-6">
            <h1 className="text-4xl font-black text-amber-400 mb-3">How to Play</h1>
            <p className="text-stone-400 text-lg max-w-xl mx-auto">
              Build your bootlegging empire across Prohibition-era America. Outrun the law, outmaneuver rivals, and be the richest syndicate when Winter 1933 arrives.
            </p>
          </div>

          {/* Overview */}
          <Section id="overview" emoji="🥃" title="Overview">
            <Rule>
              Prohibitioner is an async multiplayer strategy game for 2–5 players. The game spans <strong className="text-stone-200">13–52 seasons</strong> spanning 1921–1933. The player with the highest net worth at the end wins.
            </Rule>
            <Rule>
              Each player controls a bootlegging operation: a home city with a distillery, at least one vehicle, and a growing network of territory across the map.
            </Rule>
            <Callout>
              <strong>Objective:</strong> Maximize your net worth through alcohol production, smart trading, territory control, and completed missions — while staying out of jail.
            </Callout>
            <Rule>
              Games are turn-based and asynchronous — you don't need to be online at the same time as your opponents. You'll receive an email notification when it's your turn.
            </Rule>
          </Section>

          {/* Turns */}
          <Section id="turns" emoji="🎲" title="Turn Structure">
            <Rule>
              On your turn you can take <strong className="text-stone-200">free actions</strong> first (buying, selling, upgrading, bribing, setting traps), then one <strong className="text-stone-200">terminal action</strong> to end your turn.
            </Rule>
            <div className="bg-stone-900 border border-stone-700 rounded-lg p-4 space-y-2">
              <p className="text-xs text-stone-500 uppercase tracking-wider font-bold mb-3">Free actions (any order, any number)</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ['🏪', 'Buy alcohol from market'],
                  ['💰', 'Sell alcohol from your vehicle'],
                  ['⌂', 'Pick up from your distillery'],
                  ['⚗', 'Upgrade your still'],
                  ['🏴', 'Claim or take over a city'],
                  ['💵', 'Bribe a city official'],
                  ['🪤', 'Set a trap in a city'],
                ].map(([icon, label]) => (
                  <div key={label} className="flex items-center gap-2 text-stone-300">
                    <span>{icon}</span><span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-stone-900 border border-stone-700 rounded-lg p-4 space-y-2">
              <p className="text-xs text-stone-500 uppercase tracking-wider font-bold mb-3">Terminal actions (end your turn)</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ['🎲', 'Roll to Move — spend points across your fleet'],
                  ['🏠', 'Stay Put — end turn without moving'],
                ].map(([icon, label]) => (
                  <div key={label} className="flex items-center gap-2 text-stone-300">
                    <span>{icon}</span><span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <Rule>
              When you <strong className="text-stone-200">Roll to Move</strong>, you roll multiple d6 dice — one extra die per vehicle you own. The total becomes your movement budget to spend routing your vehicles to new cities.
            </Rule>
            <Callout color="amber">
              <strong>Season rollover:</strong> After every player has taken a turn, a new season begins. Your distilleries automatically produce alcohol and market prices refresh.
            </Callout>
          </Section>

          {/* Distillery */}
          <Section id="distillery" emoji="⚗" title="Distilleries & Production">
            <Rule>
              Every player starts with a Tier 1 distillery in their home city. Each season rollover, your distilleries automatically produce alcohol and store it in the city.
            </Rule>
            <Rule>
              You can own up to <strong className="text-stone-200">3 distilleries</strong> — one per city you control. Claim new cities to expand your production network.
            </Rule>
            <div className="bg-stone-900 border border-stone-700 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-stone-500 uppercase tracking-wider border-b border-stone-700">
                    <th className="text-left px-4 py-2 font-normal">Tier</th>
                    <th className="text-left px-4 py-2 font-normal">Name</th>
                    <th className="text-right px-4 py-2 font-normal">Output/season</th>
                    <th className="text-right px-4 py-2 font-normal">Heat/season</th>
                    <th className="text-right px-4 py-2 font-normal">Upgrade cost</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [1, 'Stills (Moonshine base)',  2,  1, '$200'],
                    [2, 'Filters & Barrels',        4,  2, '$500'],
                    [3, 'Aging Tanks',              7,  4, '$1,000'],
                    [4, 'Botanical Infusers',       11, 7, '$2,000'],
                    [5, 'Master Distillery',        17, 12,'$4,000'],
                  ].map(([tier, name, output, heat, cost]) => (
                    <tr key={tier as number} className="border-b border-stone-800 last:border-0">
                      <td className="px-4 py-2 text-amber-400 font-bold">{tier}</td>
                      <td className="px-4 py-2 text-stone-300">{name as string}</td>
                      <td className="px-4 py-2 text-right text-green-400">{output} units</td>
                      <td className="px-4 py-2 text-right text-red-400">+{heat}</td>
                      <td className="px-4 py-2 text-right text-stone-400">{cost as string}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Rule>
              Higher-tier stills produce more but also generate passive heat each season. Balance production against your ability to manage heat.
            </Rule>
            <Callout color="green">
              <strong>Tip:</strong> Upgrade your still early. The jump from Tier 1 to Tier 3 more than triples your output — compound profits across all seasons are enormous.
            </Callout>
          </Section>

          {/* Market */}
          <Section id="market" emoji="🏪" title="The Market">
            <Rule>
              Every city has a marketplace where you can buy and sell alcohol. Prices vary by city and refresh each season.
            </Rule>
            <Rule>
              <strong className="text-stone-200">The city that produces an alcohol type always sells it at the lowest price.</strong> Buy local, sell elsewhere for maximum profit.
            </Rule>
            <div className="bg-stone-900 border border-stone-700 rounded-lg p-4 space-y-2">
              <p className="text-xs text-stone-500 uppercase tracking-wider font-bold mb-2">Market actions</p>
              {[
                ['Take from still', 'Load your distillery\'s output into your vehicle for free.'],
                ['Sell from still', 'Sell distillery stock directly without loading it — faster but you lose the hauling margin.'],
                ['Buy', 'Purchase the maximum units you can afford and carry at the city\'s current price.'],
                ['Sell', 'Sell alcohol from your vehicle\'s cargo at the city\'s current price.'],
              ].map(([action, desc]) => (
                <div key={action as string} className="flex gap-3">
                  <span className="text-amber-400 font-bold text-xs flex-shrink-0 pt-0.5 w-28">{action as string}</span>
                  <span className="text-stone-400 text-xs">{desc as string}</span>
                </div>
              ))}
            </div>
            <Callout color="green">
              <strong>Strategy:</strong> The haul loop — pick up from your distillery, drive to a city with high prices, sell. Repeat. Alcohol produced locally is cheapest to buy; distant cities pay a premium.
            </Callout>
          </Section>

          {/* Vehicles */}
          <Section id="vehicles" emoji="🚗" title="Vehicles & Movement">
            <Rule>
              Each player starts with one vehicle. You can buy additional vehicles to expand your fleet and move more cargo per turn.
            </Rule>
            <div className="bg-stone-900 border border-stone-700 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-stone-500 uppercase tracking-wider border-b border-stone-700">
                    <th className="text-left px-4 py-2 font-normal">Vehicle</th>
                    <th className="text-right px-4 py-2 font-normal">Speed</th>
                    <th className="text-right px-4 py-2 font-normal">Cargo slots</th>
                    <th className="text-right px-4 py-2 font-normal">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Workhorse (Model T)',       '×1.0', 16,  '$300'],
                    ['Roadster',                  '×1.2', 10,  '$500'],
                    ['Delivery Truck',            '×0.8', 28,  '$700'],
                    ['Whiskey Runner (Motorcycle)','×1.5', 6,   '$900'],
                  ].map(([name, speed, cargo, cost]) => (
                    <tr key={name as string} className="border-b border-stone-800 last:border-0">
                      <td className="px-4 py-2 text-stone-300">{name as string}</td>
                      <td className="px-4 py-2 text-right text-amber-300">{speed as string}</td>
                      <td className="px-4 py-2 text-right text-blue-300">{cargo}</td>
                      <td className="px-4 py-2 text-right text-stone-400">{cost as string}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Rule>
              When you roll to move, the total dice result is your movement budget for the turn, shared across your entire fleet. Assign points to each vehicle to route them to different cities.
            </Rule>
            <Rule>
              A vehicle parked in the same city for <strong className="text-stone-200">4 seasons</strong> will receive a warning. After 5 seasons idle, it breaks down and requires a repair fee — or you can abandon it permanently.
            </Rule>
            <Callout color="amber">
              <strong>More vehicles = more dice.</strong> You roll one extra die per additional vehicle, so a 3-vehicle fleet rolls considerably more movement points per turn.
            </Callout>
          </Section>

          {/* Heat */}
          <Section id="heat" emoji="🌡" title="Heat & Police">
            <Rule>
              Heat (0–100) represents how much law enforcement attention you've attracted. It rises through illegal activity and falls slightly each idle season.
            </Rule>
            <div className="bg-stone-900 border border-stone-700 rounded-lg p-4 space-y-1.5">
              <p className="text-xs text-stone-500 uppercase tracking-wider font-bold mb-2">What raises heat</p>
              {[
                ['+5–15',  'Moving through cities (road travel)'],
                ['+15',   'Stealing inventory from a rival'],
                ['+10–20','Police encounter (running from cops)'],
                ['varies','Passive heat from high-tier stills each season'],
              ].map(([amount, action]) => (
                <div key={action as string} className="flex gap-3 text-xs">
                  <span className="text-red-400 font-bold w-16 flex-shrink-0">{amount as string}</span>
                  <span className="text-stone-400">{action as string}</span>
                </div>
              ))}
            </div>
            <Rule>
              When your heat is high enough, you'll trigger a <strong className="text-stone-200">police encounter</strong> on a move. You have three options:
            </Rule>
            <div className="grid grid-cols-3 gap-3">
              {[
                ['Submit',  'Pay a fine, lose some cargo, lose your turn. Heat drops significantly.', 'text-amber-400'],
                ['Bribe',   'Pay the officer a spot bribe. Keep your cargo and continue. Expensive at high heat.', 'text-green-400'],
                ['Run',     'Risk it. If you escape, no penalty. If caught, you\'re jailed for multiple seasons.', 'text-red-400'],
              ].map(([opt, desc, color]) => (
                <div key={opt as string} className="bg-stone-900 border border-stone-700 rounded-lg p-3">
                  <p className={`font-bold text-sm mb-1 ${color as string}`}>{opt as string}</p>
                  <p className="text-stone-400 text-xs leading-relaxed">{desc as string}</p>
                </div>
              ))}
            </div>
            <Callout color="red">
              <strong>Jail:</strong> If you're sent to jail, you skip multiple turns but can still submit free actions (buy, sell, upgrade) from your cell. You just can't move.
            </Callout>
          </Section>

          {/* Territory */}
          <Section id="territory" emoji="🏴" title="Claiming Territory">
            <Rule>
              Claim a neutral city by visiting it with a vehicle and paying the claim cost. Claiming gives you a Tier 1 distillery there — free production from turn one.
            </Rule>
            <Rule>
              You can <strong className="text-stone-200">take over a rival's city</strong> by visiting and paying double the claim cost. Their distillery is replaced with yours at Tier 1. Hostile takeovers generate significant heat.
            </Rule>
            <Rule>
              Owning more cities means more distilleries, more production, and higher passive income — but also more heat generated each season.
            </Rule>
            <Callout color="amber">
              <strong>Defense:</strong> Park a vehicle in your city to hard-block rivals from stealing your inventory. They can still take over the city, but they can't raid your stock.
            </Callout>
          </Section>

          {/* Missions */}
          <Section id="missions" emoji="📜" title="Mission Cards">
            <Rule>
              Mission cards give you optional objectives with cash rewards. You can hold up to 3 active missions at a time.
            </Rule>
            <Rule>
              Draw a new card from the Missions panel on any turn. Missions track progress automatically — you'll be notified and rewarded the moment you complete one.
            </Rule>
            <Rule>
              Mission types include: <span className="text-stone-200">sell X units of a specific alcohol</span>, <span className="text-stone-200">carry X units in your cargo</span>, <span className="text-stone-200">claim N cities</span>, <span className="text-stone-200">earn a total cash amount</span>, and more.
            </Rule>
            <Callout color="green">
              <strong>Rewards scale with difficulty.</strong> Early missions pay a few hundred dollars; late-game missions can pay thousands. Always keep a mission slot filled.
            </Callout>
          </Section>

          {/* Bribes */}
          <Section id="bribe" emoji="💰" title="Bribing Officials">
            <Rule>
              Pay a city official to look the other way. A bribe makes a city <strong className="text-stone-200">police-free for 4 seasons</strong> — any player who moves through won't trigger an encounter.
            </Rule>
            <Rule>
              Bribes cost more in larger cities, but the protection is city-specific and applies to everyone — including rivals passing through.
            </Rule>
            <Rule>
              Some characters modify bribe duration. The <em>Vixen</em>, for example, extends bribes to 6 seasons.
            </Rule>
            <Callout color="amber">
              <strong>Strategic use:</strong> Bribe your own cities to create safe corridors. Rivals benefit too, but you can use it to lower your own heat exposure on busy trade routes.
            </Callout>
          </Section>

          {/* Traps */}
          <Section id="traps" emoji="🪤" title="Setting Traps">
            <Rule>
              Plant a trap in any city where you have a vehicle. If a rival passes through, they trigger the trap: they <strong className="text-stone-200">lose their next turn</strong> and pay you a fee.
            </Rule>
            <Rule>
              Traps are invisible to other players. You can only have one trap active per city.
            </Rule>
            <Rule>
              Traps expire after a few seasons if nobody triggers them.
            </Rule>
            <Callout color="blue">
              <strong>Best used</strong> on busy routes between high-value cities, or near your own territory to punish rivals scouting a takeover.
            </Callout>
          </Section>

          {/* Alliances */}
          <Section id="alliances" emoji="🤝" title="Alliances">
            <Rule>
              Request an alliance with any other player from the Alliance panel. If they accept, you become allies.
            </Rule>
            <Rule>
              Allies can <strong className="text-stone-200">visit each other's cities without paying entry fees</strong>. Rivals are charged when moving through owned cities.
            </Rule>
            <Rule>
              Allies won't be able to steal inventory from each other or take over each other's cities. Alliances can be broken at any time.
            </Rule>
            <Callout color="blue">
              <strong>Diplomacy matters.</strong> A well-timed alliance can lock down a region of the map or protect you while you focus on production.
            </Callout>
          </Section>

          {/* Characters */}
          <Section id="characters" emoji="🎭" title="Characters">
            <Rule>
              Each player chooses a character at the start of the game. Characters have a unique <strong className="text-stone-200">perk</strong> and a <strong className="text-stone-200">drawback</strong> that shape your playstyle for the entire game.
            </Rule>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { name: 'The Priest / Nun',         perk: '-25% heat generation',                    drawback: '-20% cargo capacity' },
                { name: 'The Hillbilly',             perk: '-20% still upgrade costs',               drawback: '-10% movement' },
                { name: 'The Gangster',              perk: 'Claim cities 25% cheaper',               drawback: '+20% heat generation' },
                { name: 'The Vixen',                 perk: 'Bribes last 6 seasons (vs 4)',            drawback: '-10% alcohol production' },
                { name: 'The Pharmacist',            perk: 'Sell whiskey at +50% value',             drawback: 'Takeovers cost +25%' },
                { name: 'The Jazz Singer',           perk: 'Passive income in large / major cities', drawback: '+15% heat generation' },
                { name: 'The Bootlegger (Clyde)',    perk: '+2 permanent movement bonus',            drawback: '+20% heat generation' },
                { name: 'The Socialite (Eleanor)',   perk: '+25% sell price everywhere',             drawback: '-20% alcohol production' },
                { name: 'The Union Leader (Big Mike)',perk: '+20% alcohol production',               drawback: 'Takeovers cost +20%' },
                { name: 'The Rum-Runner (Capt. Morgan)', perk: 'Coastal cities produce double',      drawback: '-15% sell price everywhere' },
              ].map(c => (
                <div key={c.name} className="bg-stone-900 border border-stone-700 rounded-lg p-3">
                  <p className="text-amber-300 font-bold text-sm mb-1">{c.name}</p>
                  <p className="text-green-400 text-xs mb-0.5">✦ {c.perk}</p>
                  <p className="text-red-400 text-xs">✗ {c.drawback}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Winning */}
          <Section id="winning" emoji="🏆" title="Winning the Game">
            <Rule>
              The game ends after <strong className="text-stone-200">the final season (Autumn 1933)</strong> — the end of Prohibition. The player with the highest net worth wins.
            </Rule>
            <div className="bg-stone-900 border border-stone-700 rounded-lg p-4">
              <p className="text-xs text-stone-500 uppercase tracking-wider font-bold mb-3">Net worth includes</p>
              <div className="space-y-1.5">
                {[
                  ['💵', 'Cash on hand'],
                  ['⚗', 'Distillery value (50% of upgrade cost)'],
                  ['🏴', 'Owned cities (base value per city)'],
                  ['🚗', 'Vehicle fleet value'],
                  ['🎒', 'Cargo value (inventory × current market price)'],
                ].map(([icon, item]) => (
                  <div key={item as string} className="flex items-center gap-2 text-sm">
                    <span>{icon as string}</span>
                    <span className="text-stone-300">{item as string}</span>
                  </div>
                ))}
              </div>
            </div>
            <Callout color="amber">
              <strong>Winter 1933 decides it all.</strong> Don't just hoard cash — invest in stills, vehicles, and territory. The endgame tally rewards players who built a real empire.
            </Callout>
          </Section>


        </main>
      </div>
    </div>
  )
}
