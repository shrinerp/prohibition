export const landingHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Prohibitioner — Turn-Based Bootlegging Strategy Game</title>
  <meta name="description" content="Create, distribute, and sell alcohol to rule the underground. Prohibitioner is a turn-based multiplayer strategy game set in 1920s Prohibition-era America." />
  <meta name="keywords" content="prohibition game, bootlegging game, turn-based strategy, multiplayer board game, 1920s game, speakeasy game" />
  <meta name="author" content="Senders LLC" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://prohibitioner.com/" />
  <meta property="og:title" content="Prohibitioner — Turn-Based Bootlegging Strategy Game" />
  <meta property="og:description" content="Create, distribute, and sell alcohol to rule the underground. Async multiplayer strategy across 52 Prohibition-era cities." />
  <meta property="og:image" content="https://prohibitioner.com/screenshot.png" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Prohibitioner — Turn-Based Bootlegging Strategy Game" />
  <meta name="twitter:description" content="Outsmart rivals, run your empire, and amass the biggest fortune during Prohibition." />
  <meta name="twitter:image" content="https://prohibitioner.com/screenshot.png" />

  <!-- PWA -->
  <meta name="theme-color" content="#1a0f00" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

  <!-- Canonical -->
  <link rel="canonical" href="https://prohibitioner.com/" />

  <!-- Structured data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    "name": "Prohibitioner",
    "description": "Turn-based multiplayer strategy game set during American Prohibition (1920–1933). Players produce alcohol, trade across 52 US cities, bribe officials, and evade police.",
    "url": "https://prohibitioner.com",
    "screenshot": "https://prohibitioner.com/screenshot.png",
    "genre": ["Strategy", "Board Game", "Multiplayer"],
    "numberOfPlayers": { "@type": "QuantitativeValue", "minValue": 2, "maxValue": 5 },
    "operatingSystem": "Web, iOS, Android",
    "applicationCategory": "Game",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "publisher": { "@type": "Organization", "name": "Senders LLC" }
  }
  </script>

  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            amber: {
              300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b',
              600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f',
            }
          },
          fontFamily: { serif: ['Georgia', 'serif'] }
        }
      }
    }
  </script>
  <style>
    body { background-color: #0c0a09; }
    .hero-glow { box-shadow: 0 0 80px rgba(251,191,36,0.08), 0 0 160px rgba(251,191,36,0.04); }
    .screenshot-frame {
      box-shadow: 0 0 0 1px rgba(251,191,36,0.2), 0 24px 80px rgba(0,0,0,0.8);
    }
  </style>
</head>
<body class="text-stone-200 antialiased">

  <!-- Navigation -->
  <nav class="fixed top-0 inset-x-0 z-50 border-b border-stone-800/80 bg-stone-950/90 backdrop-blur-sm">
    <div class="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
      <!-- Logo -->
      <a href="/" class="flex items-center gap-2">
        <img src="/logo.png" alt="Prohibitioner" class="h-8 w-auto object-contain" />
      </a>

      <!-- Nav links -->
      <div class="hidden sm:flex items-center gap-6 text-sm">
        <a href="/install" class="text-stone-400 hover:text-amber-400 transition">Mobile Install</a>
        <a href="/register" class="text-stone-400 hover:text-amber-400 transition">Register</a>
        <a href="/login" class="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold rounded transition text-xs uppercase tracking-wide">
          Sign In
        </a>
      </div>

      <!-- Mobile nav -->
      <div class="sm:hidden flex items-center gap-3">
        <a href="/register" class="text-stone-400 hover:text-amber-400 text-sm transition">Register</a>
        <a href="/login" class="px-3 py-1.5 bg-amber-600 text-stone-900 font-bold rounded text-xs uppercase">Sign In</a>
      </div>
    </div>
  </nav>

  <!-- Hero -->
  <section class="pt-32 pb-20 px-6 text-center relative overflow-hidden">
    <!-- Subtle background texture -->
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(120,53,15,0.12)_0%,transparent_70%)] pointer-events-none"></div>

    <div class="max-w-4xl mx-auto relative">
      <div class="inline-block text-xs uppercase tracking-widest text-amber-600 font-bold border border-amber-800/60 rounded-full px-4 py-1 mb-8">
        1920 – 1933 · Prohibition Era
      </div>

      <div class="flex justify-center mb-8">
        <img src="/logo.png" alt="Prohibitioner: Risk and Profit" class="w-80 sm:w-96 object-contain drop-shadow-2xl" />
      </div>

      <h1 class="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-amber-300 leading-tight mb-6">
        Create, distribute, and sell<br class="hidden sm:block" />
        alcohol to rule the underground.
      </h1>

      <p class="text-stone-400 text-lg sm:text-xl max-w-2xl mx-auto mb-4">
        Turn-based online strategy game set in the roaring 1920s.
      </p>
      <p class="text-stone-500 text-base max-w-xl mx-auto mb-10">
        Outsmart rivals, run your empire, and amass the biggest fortune during Prohibition.
      </p>

      <div class="flex flex-col sm:flex-row gap-3 justify-center mb-16">
        <a href="/games"
           class="px-8 py-3.5 bg-amber-600 hover:bg-amber-500 text-stone-900 font-black text-sm uppercase tracking-wider rounded transition">
          Play Now
        </a>
        <a href="/register"
           class="px-8 py-3.5 border border-stone-600 hover:border-amber-700 hover:bg-amber-950/40 text-stone-300 font-bold text-sm uppercase tracking-wider rounded transition">
          Create Account
        </a>
      </div>

      <!-- Screenshot -->
      <div class="rounded-xl overflow-hidden screenshot-frame hero-glow">
        <img
          src="/screenshot.png"
          alt="Prohibitioner game interface showing a US map with city connections, player inventory, and turn actions"
          class="w-full object-cover"
          width="1280"
          height="800"
        />
      </div>
    </div>
  </section>

  <!-- Divider -->
  <div class="max-w-6xl mx-auto px-6">
    <hr class="border-stone-800" />
  </div>

  <!-- Features -->
  <section class="py-20 px-6">
    <div class="max-w-6xl mx-auto">
      <p class="text-center text-xs uppercase tracking-widest text-stone-600 font-bold mb-12">How it works</p>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

        <!-- Feature 1 -->
        <div class="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden hover:border-amber-900 transition">
          <div class="p-6 pb-3">
            <h2 class="font-serif text-amber-300 font-bold text-lg">Over 50 Cities to Play With</h2>
          </div>
          <div class="aspect-square overflow-hidden">
            <img src="/landing-cities.png" alt="Bootleggers loading jugs onto a train in Chattanooga" class="w-full h-full object-cover" />
          </div>
          <div class="p-6 pt-4">
            <p class="text-stone-500 text-sm leading-relaxed">
              Every game picks a random set of cities to create a unique gameplay experience. From Chicago to New Orleans, each city has its own market prices, primary alcohol, and police presence.
            </p>
          </div>
        </div>

        <!-- Feature 2 -->
        <div class="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden hover:border-amber-900 transition">
          <div class="p-6 pb-3">
            <h2 class="font-serif text-amber-300 font-bold text-lg">Unique Characters</h2>
          </div>
          <div class="aspect-square overflow-hidden">
            <img src="/landing-characters.png" alt="A hillbilly moonshiner standing before his copper still in the woods" class="w-full h-full object-cover" />
          </div>
          <div class="p-6 pt-4">
            <p class="text-stone-500 text-sm leading-relaxed">
              Choose from 10 authentic characters from the Prohibition era — each with unique talents that affect heat, movement, cargo capacity, and bribe costs. Play as the Hillbilly, the Vixen, the Gangster, and more.
            </p>
          </div>
        </div>

        <!-- Feature 3 -->
        <div class="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden hover:border-amber-900 transition">
          <div class="p-6 pb-3">
            <h2 class="font-serif text-amber-300 font-bold text-lg">Increase Capacity</h2>
          </div>
          <div class="aspect-square overflow-hidden">
            <img src="/landing-stills.png" alt="A copper pot still distilling moonshine in a rustic barn" class="w-full h-full object-cover" />
          </div>
          <div class="p-6 pt-4">
            <p class="text-stone-500 text-sm leading-relaxed">
              Upgrade your stills through 5 tiers to increase alcohol production per season. Claim new cities to expand your distillery network across the country.
            </p>
          </div>
        </div>

      </div>
    </div>
  </section>

  <!-- Secondary CTA -->
  <section class="py-16 px-6 border-t border-stone-800">
    <div class="max-w-2xl mx-auto text-center">
      <h2 class="font-serif text-2xl sm:text-3xl text-amber-300 font-bold mb-4">
        Ready to run your empire?
      </h2>
      <p class="text-stone-500 text-sm mb-8">
        Async multiplayer — play your turn whenever you want. The game emails you when it's your move.
      </p>
      <a href="/register"
         class="inline-block px-10 py-3.5 bg-amber-600 hover:bg-amber-500 text-stone-900 font-black text-sm uppercase tracking-wider rounded transition">
        Register Free
      </a>
    </div>
  </section>

  <!-- Footer -->
  <footer class="border-t border-stone-800 py-8 px-6">
    <div class="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-600">
      <span>© 2026 Senders LLC</span>
      <div class="flex items-center gap-5">
        <a href="/install" class="hover:text-stone-400 transition">Mobile Install</a>
        <a href="/register" class="hover:text-stone-400 transition">Register</a>
        <a href="/login" class="hover:text-stone-400 transition">Login</a>
      </div>
    </div>
  </footer>

</body>
</html>`
