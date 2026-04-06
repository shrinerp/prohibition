export const installHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Install Prohibitioner — Play on Your Phone</title>
  <meta name="description" content="Install Prohibitioner as an app on your iPhone or Android phone. Play the Prohibition-era strategy game from your home screen." />
  <link rel="canonical" href="https://prohibitioner.com/install" />
  <meta name="theme-color" content="#1a0f00" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #0c0a09; }
    .step-number {
      width: 28px; height: 28px; flex-shrink: 0;
      background: rgba(217,119,6,0.15);
      border: 1px solid rgba(217,119,6,0.4);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; color: #fbbf24;
    }
    .tab-btn { transition: all 150ms; }
    .tab-btn.active {
      background: rgba(217,119,6,0.15);
      border-color: rgba(217,119,6,0.5);
      color: #fbbf24;
    }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }
  </style>
</head>
<body class="text-stone-200 antialiased min-h-screen">

  <!-- Navigation -->
  <nav class="fixed top-0 inset-x-0 z-50 border-b border-stone-800/80 bg-stone-950/90 backdrop-blur-sm">
    <div class="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
      <a href="/" class="flex items-center gap-2">
        <img src="/logo.png" alt="Prohibitioner" class="h-8 w-auto object-contain" />
        <span class="font-bold text-amber-400 tracking-wide" style="font-family: Georgia, serif">Prohibitioner</span>
      </a>
      <div class="flex items-center gap-4 text-sm">
        <a href="/register" class="text-stone-400 hover:text-amber-400 transition">Register</a>
        <a href="/login" class="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold rounded text-xs uppercase tracking-wide transition">Sign In</a>
      </div>
    </div>
  </nav>

  <!-- Hero -->
  <main class="pt-28 pb-20 px-6 max-w-xl mx-auto">
    <div class="text-center mb-10">
      <div class="text-5xl mb-5">📲</div>
      <h1 class="text-3xl font-bold text-amber-300 mb-3" style="font-family: Georgia, serif">
        Install on Your Phone
      </h1>
      <p class="text-stone-400 text-sm leading-relaxed">
        Prohibitioner is a Progressive Web App. Install it once and it lives on your home screen — no App Store needed.
      </p>
    </div>

    <!-- Platform tabs -->
    <div class="flex gap-2 mb-6">
      <button onclick="switchTab('ios')" id="tab-ios"
        class="tab-btn active flex-1 py-2.5 border border-stone-700 rounded-lg text-sm font-bold text-stone-300 flex items-center justify-center gap-2">
         iPhone / iPad
      </button>
      <button onclick="switchTab('android')" id="tab-android"
        class="tab-btn flex-1 py-2.5 border border-stone-700 rounded-lg text-sm font-bold text-stone-300 flex items-center justify-center gap-2">
        🤖 Android
      </button>
    </div>

    <!-- iOS instructions -->
    <div id="panel-ios" class="tab-panel active space-y-3">
      <div class="bg-amber-950/20 border border-amber-900/40 rounded-xl p-4 text-xs text-amber-400/80 flex gap-2">
        <span>⚠️</span>
        <span>Must use <strong>Safari</strong> — Chrome and other browsers on iPhone don't support PWA install.</span>
      </div>

      <div class="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden divide-y divide-stone-800">

        <div class="flex items-start gap-4 p-4">
          <div class="step-number">1</div>
          <div>
            <p class="text-sm font-semibold text-stone-200 mb-1">Open Safari</p>
            <p class="text-xs text-stone-500 leading-relaxed">Navigate to <span class="font-mono text-amber-500">prohibitioner.com</span> in Safari on your iPhone or iPad.</p>
          </div>
        </div>

        <div class="flex items-start gap-4 p-4">
          <div class="step-number">2</div>
          <div>
            <p class="text-sm font-semibold text-stone-200 mb-1">Tap the Share button</p>
            <p class="text-xs text-stone-500 leading-relaxed">
              At the bottom of the screen, tap the Share icon —
              <span class="inline-block bg-stone-800 rounded px-1.5 py-0.5 font-mono text-stone-300 text-xs">⬆</span>
              (a box with an arrow pointing up). On iPad it's in the top bar.
            </p>
          </div>
        </div>

        <div class="flex items-start gap-4 p-4">
          <div class="step-number">3</div>
          <div>
            <p class="text-sm font-semibold text-stone-200 mb-1">Tap "Add to Home Screen"</p>
            <p class="text-xs text-stone-500 leading-relaxed">Scroll down in the share sheet and tap <strong class="text-stone-300">Add to Home Screen</strong>. You may need to scroll right in the second row of icons to find it.</p>
          </div>
        </div>

        <div class="flex items-start gap-4 p-4">
          <div class="step-number">4</div>
          <div>
            <p class="text-sm font-semibold text-stone-200 mb-1">Tap "Add"</p>
            <p class="text-xs text-stone-500 leading-relaxed">A preview will appear showing the app name. Tap <strong class="text-stone-300">Add</strong> in the top-right corner to confirm.</p>
          </div>
        </div>

        <div class="flex items-start gap-4 p-4">
          <div class="step-number">5</div>
          <div>
            <p class="text-sm font-semibold text-stone-200 mb-1">Launch from your home screen</p>
            <p class="text-xs text-stone-500 leading-relaxed">The Prohibitioner icon will appear on your home screen. Tap it to open in full-screen mode — no browser chrome, just the game.</p>
          </div>
        </div>

      </div>
    </div>

    <!-- Android instructions -->
    <div id="panel-android" class="tab-panel space-y-3">
      <div class="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden divide-y divide-stone-800">

        <div class="flex items-start gap-4 p-4">
          <div class="step-number">1</div>
          <div>
            <p class="text-sm font-semibold text-stone-200 mb-1">Open Chrome</p>
            <p class="text-xs text-stone-500 leading-relaxed">Navigate to <span class="font-mono text-amber-500">prohibitioner.com</span> in Google Chrome on your Android device.</p>
          </div>
        </div>

        <div class="flex items-start gap-4 p-4">
          <div class="step-number">2</div>
          <div>
            <p class="text-sm font-semibold text-stone-200 mb-1">Tap the menu</p>
            <p class="text-xs text-stone-500 leading-relaxed">
              Tap the three-dot menu
              <span class="inline-block bg-stone-800 rounded px-1.5 py-0.5 font-mono text-stone-300 text-xs">⋮</span>
              in the top-right corner of Chrome.
            </p>
          </div>
        </div>

        <div class="flex items-start gap-4 p-4">
          <div class="step-number">3</div>
          <div>
            <p class="text-sm font-semibold text-stone-200 mb-1">Tap "Add to Home screen"</p>
            <p class="text-xs text-stone-500 leading-relaxed">Select <strong class="text-stone-300">Add to Home screen</strong> from the menu. Chrome may also show an install banner at the bottom of the screen — tap that instead if it appears.</p>
          </div>
        </div>

        <div class="flex items-start gap-4 p-4">
          <div class="step-number">4</div>
          <div>
            <p class="text-sm font-semibold text-stone-200 mb-1">Tap "Install" or "Add"</p>
            <p class="text-xs text-stone-500 leading-relaxed">Confirm by tapping <strong class="text-stone-300">Install</strong> or <strong class="text-stone-300">Add</strong> in the dialog that appears.</p>
          </div>
        </div>

        <div class="flex items-start gap-4 p-4">
          <div class="step-number">5</div>
          <div>
            <p class="text-sm font-semibold text-stone-200 mb-1">Launch from your home screen</p>
            <p class="text-xs text-stone-500 leading-relaxed">The Prohibitioner icon will appear on your home screen and app drawer. It opens in full-screen mode like a native app.</p>
          </div>
        </div>

      </div>
    </div>

    <!-- Already have an account? -->
    <div class="mt-8 bg-stone-900 border border-stone-800 rounded-xl p-5 text-center">
      <p class="text-stone-400 text-sm mb-4">Ready to play?</p>
      <div class="flex gap-3 justify-center">
        <a href="/login" class="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold text-sm rounded uppercase tracking-wide transition">Sign In</a>
        <a href="/register" class="px-6 py-2.5 border border-stone-600 hover:border-amber-700 text-stone-300 font-bold text-sm rounded uppercase tracking-wide transition">Register Free</a>
      </div>
    </div>

    <div class="text-center mt-8">
      <a href="/" class="text-stone-600 hover:text-stone-400 text-sm transition">← Back to home</a>
    </div>
  </main>

  <footer class="border-t border-stone-800 py-8 px-6">
    <div class="max-w-6xl mx-auto text-center text-xs text-stone-600">
      © 2026 Senders LLC
    </div>
  </footer>

  <script>
    function switchTab(platform) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))
      document.getElementById('tab-' + platform).classList.add('active')
      document.getElementById('panel-' + platform).classList.add('active')
    }
  </script>

</body>
</html>`
