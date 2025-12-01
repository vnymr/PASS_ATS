/**
 * Browser Launcher Helper
 * Centralized Playwright browser launching with production support
 * MIGRATED FROM PUPPETEER TO PLAYWRIGHT
 * ENHANCED WITH PLAYWRIGHT-EXTRA STEALTH MODE
 */

import { chromium } from 'playwright-extra';
import { firefox } from 'playwright-core'; // For Camoufox remote connection
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import logger from './logger.js';
import { execSync } from 'child_process';
import proxyRotator from './proxy-rotator.js';

// Add stealth plugin to playwright-extra
chromium.use(StealthPlugin());

/**
 * Find Chromium executable path
 * Handles Railway/Nixpacks environment with dynamic path resolution
 */
function findChromiumPath() {
  // If PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH is explicitly set, use it
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH &&
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH !== '*') {
    logger.info(`Using PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: ${process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}`);
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }

  // No longer supporting PUPPETEER_EXECUTABLE_PATH - fully migrated to Playwright

  // Try to find Playwright's bundled Chromium (most reliable)
  try {
    // Look for Playwright's cache directory
    const homeDir = process.env.HOME || '/root';
    const playwrightCachePaths = [
      `${homeDir}/Library/Caches/ms-playwright`,
      `${homeDir}/.cache/ms-playwright`,
      '/root/.cache/ms-playwright'
    ];

    for (const cachePath of playwrightCachePaths) {
      try {
        const chromiumPath = execSync(`find ${cachePath} -name chrome -o -name chromium -type f 2>/dev/null | head -1`,
          { encoding: 'utf8' }
        ).trim();

        if (chromiumPath) {
          logger.info(`Found Playwright bundled Chromium: ${chromiumPath}`);
          return chromiumPath;
        }
      } catch (e) {
        // Continue to next path
      }
    }
  } catch (error) {
    logger.debug('Could not find Playwright bundled Chromium');
  }

  // Try to find system chromium using which command
  try {
    const path = execSync('which chromium || which chromium-browser || which google-chrome',
      { encoding: 'utf8' }
    ).trim();

    if (path) {
      logger.info(`Found system Chromium: ${path}`);
      return path;
    }
  } catch (error) {
    logger.debug('Could not find system Chromium');
  }

  // Try Nix store path (Railway with Nixpacks)
  try {
    const nixPath = execSync('find /nix/store -name chromium -type f 2>/dev/null | head -1',
      { encoding: 'utf8' }
    ).trim();

    if (nixPath) {
      logger.info(`Found Chromium in Nix store: ${nixPath}`);
      return nixPath;
    }
  } catch (error) {
    logger.debug('Could not find Chromium in Nix store');
  }

  logger.info('Using Playwright default bundled Chromium');
  return undefined;
}

/**
 * Get standard browser launch arguments
 * Optimized for production containerized environments
 */
function getStandardArgs(options = {}) {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu'
  ];

  if (options.stealth) {
    args.push(
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process'
    );
  }

  if (options.extraArgs) {
    args.push(...options.extraArgs);
  }

  return args;
}

/**
 * Launch browser with production support
 * @param {Object} options - Launch options
 * @param {boolean} options.headless - Run in headless mode (default: true in production)
 * @param {boolean} options.stealth - Use stealth mode to avoid detection (default: false)
 * @param {string} options.windowSize - Window size (default: 1920x1080)
 * @param {string[]} options.extraArgs - Additional Chrome arguments
 * @returns {Promise<Browser>} Playwright browser instance
 */
export async function launchBrowser(options = {}) {
  const executablePath = findChromiumPath();

  // Parse window size (default 1920x1080)
  const windowSize = options.windowSize || '1920,1080';
  const [width, height] = windowSize.split(',').map(Number);

  const launchOptions = {
    headless: options.headless !== false,
    args: getStandardArgs(options),
    viewport: { width, height }
  };

  // Add executable path if found
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  logger.debug({ launchOptions }, 'Launching Playwright browser');

  try {
    const browser = await chromium.launch(launchOptions);
    logger.info('✅ Playwright browser launched successfully');
    return browser;
  } catch (error) {
    logger.error({
      error: error.message,
      executablePath,
      args: launchOptions.args
    }, 'Failed to launch Playwright browser');
    throw new Error(`Browser launch failed: ${error.message}`);
  }
}

/**
 * Apply comprehensive stealth techniques to a Playwright page
 * Removes automation indicators to avoid bot detection
 * ENHANCED: 10/10 stealth with fingerprint randomization
 */
export async function applyStealthToPage(page, options = {}) {
  logger.debug('Applying ENHANCED stealth techniques to page (10/10 mode)...');

  // Generate consistent random seed for this session (fingerprint consistency)
  const sessionSeed = options.sessionSeed || Math.random();

  // 1. Remove navigator.webdriver property (most important)
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
      configurable: true
    });
  });

  // 2. Add realistic Chrome runtime object
  await page.addInitScript(() => {
    window.chrome = {
      runtime: {
        connect: () => {},
        sendMessage: () => {},
        onMessage: { addListener: () => {} }
      },
      loadTimes: function() {
        return {
          commitLoadTime: Date.now() / 1000 - Math.random() * 2,
          connectionInfo: 'h2',
          finishDocumentLoadTime: Date.now() / 1000 - Math.random(),
          finishLoadTime: Date.now() / 1000 - Math.random() * 0.5,
          firstPaintAfterLoadTime: 0,
          firstPaintTime: Date.now() / 1000 - Math.random() * 1.5,
          navigationType: 'Other',
          npnNegotiatedProtocol: 'h2',
          requestTime: Date.now() / 1000 - Math.random() * 3,
          startLoadTime: Date.now() / 1000 - Math.random() * 2.5,
          wasAlternateProtocolAvailable: false,
          wasFetchedViaSpdy: true,
          wasNpnNegotiated: true
        };
      },
      csi: function() {
        return {
          onloadT: Date.now(),
          pageT: Date.now() - Math.random() * 1000,
          startE: Date.now() - Math.random() * 2000,
          tran: 15
        };
      },
      app: {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
      }
    };
  });

  // 3. Override permissions API with realistic responses
  await page.addInitScript(() => {
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => {
      const permissionStates = {
        'geolocation': 'granted',
        'notifications': 'default',
        'push': 'default',
        'midi': 'granted',
        'camera': 'prompt',
        'microphone': 'prompt',
        'background-fetch': 'granted',
        'background-sync': 'granted',
        'persistent-storage': 'granted',
        'accelerometer': 'granted',
        'gyroscope': 'granted',
        'magnetometer': 'granted',
        'clipboard-read': 'prompt',
        'clipboard-write': 'granted'
      };

      if (parameters.name in permissionStates) {
        return Promise.resolve({ state: permissionStates[parameters.name], onchange: null });
      }
      return originalQuery(parameters);
    };
  });

  // 4. Add realistic plugins (mimicking real Chrome)
  await page.addInitScript(() => {
    const mockPlugins = [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
      { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
    ];

    const pluginArray = Object.create(PluginArray.prototype);
    mockPlugins.forEach((p, i) => {
      const plugin = Object.create(Plugin.prototype);
      Object.defineProperties(plugin, {
        name: { value: p.name },
        filename: { value: p.filename },
        description: { value: p.description },
        length: { value: 0 }
      });
      pluginArray[i] = plugin;
    });
    Object.defineProperty(pluginArray, 'length', { value: mockPlugins.length });

    Object.defineProperty(navigator, 'plugins', { get: () => pluginArray });
  });

  // 5. Add realistic languages
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
    Object.defineProperty(navigator, 'language', {
      get: () => 'en-US',
    });
  });

  // 6. Remove automation-revealing properties
  await page.addInitScript(() => {
    // Remove Selenium/WebDriver traces
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
    delete window.__nightmare;
    delete window._phantom;
    delete window.callPhantom;
    delete window._selenium;
    delete window.calledSelenium;
    delete window._Selenium_IDE_Recorder;
    delete window.__webdriver_script_fn;
    delete window.__driver_evaluate;
    delete window.__webdriver_evaluate;
    delete window.__fxdriver_evaluate;
    delete window.__driver_unwrapped;
    delete window.__webdriver_unwrapped;
    delete window.__fxdriver_unwrapped;
    delete document.__webdriver_evaluate;
    delete document.__selenium_evaluate;
    delete document.__webdriver_script_function;
    delete document.__webdriver_script_func;
    delete document.__webdriver_script_fn;
    delete document.$cdc_asdjflasutopfhvcZLmcfl_;
    delete document.$chrome_asyncScriptInfo;
  });

  // 7. Add realistic connection properties
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', {
      get: () => ({
        rtt: 50 + Math.floor(Math.random() * 50),
        downlink: 8 + Math.random() * 4,
        effectiveType: '4g',
        saveData: false,
        type: 'wifi',
        downlinkMax: 100,
        onchange: null
      }),
    });
  });

  // 8. CANVAS FINGERPRINT RANDOMIZATION (Critical for 10/10)
  await page.addInitScript((seed) => {
    const random = (function(s) {
      return function() {
        s = Math.sin(s) * 10000;
        return s - Math.floor(s);
      };
    })(seed * 999999);

    // Add subtle noise to canvas operations
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type) {
      if (type === 'image/png' || type === undefined) {
        const ctx = this.getContext('2d');
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, this.width, this.height);
          // Add imperceptible noise to a few random pixels
          for (let i = 0; i < 10; i++) {
            const idx = Math.floor(random() * imageData.data.length / 4) * 4;
            imageData.data[idx] = (imageData.data[idx] + Math.floor(random() * 2)) % 256;
          }
          ctx.putImageData(imageData, 0, 0);
        }
      }
      return originalToDataURL.apply(this, arguments);
    };

    // Override getImageData for fingerprint resistance
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function() {
      const imageData = originalGetImageData.apply(this, arguments);
      // Add minimal noise
      for (let i = 0; i < 5; i++) {
        const idx = Math.floor(random() * imageData.data.length / 4) * 4;
        imageData.data[idx] = (imageData.data[idx] + Math.floor(random() * 2)) % 256;
      }
      return imageData;
    };
  }, sessionSeed);

  // 9. WEBGL FINGERPRINT SPOOFING (Critical for 10/10)
  await page.addInitScript((seed) => {
    const random = (function(s) {
      return function() {
        s = Math.sin(s) * 10000;
        return s - Math.floor(s);
      };
    })(seed * 888888);

    // Spoof WebGL vendor/renderer
    const getParameterOriginal = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(param) {
      // UNMASKED_VENDOR_WEBGL
      if (param === 37445) {
        return 'Google Inc. (NVIDIA)';
      }
      // UNMASKED_RENDERER_WEBGL
      if (param === 37446) {
        return 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0, D3D11)';
      }
      return getParameterOriginal.apply(this, arguments);
    };

    // Also handle WebGL2
    if (typeof WebGL2RenderingContext !== 'undefined') {
      const getParameter2Original = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function(param) {
        if (param === 37445) return 'Google Inc. (NVIDIA)';
        if (param === 37446) return 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0, D3D11)';
        return getParameter2Original.apply(this, arguments);
      };
    }
  }, sessionSeed);

  // 10. WEBRTC LEAK PREVENTION (Critical for 10/10)
  await page.addInitScript(() => {
    // Disable WebRTC entirely or mask real IP
    const originalRTCPeerConnection = window.RTCPeerConnection;

    window.RTCPeerConnection = function(...args) {
      const pc = new originalRTCPeerConnection(...args);

      // Override createDataChannel to prevent IP leaks
      const originalCreateDataChannel = pc.createDataChannel.bind(pc);
      pc.createDataChannel = function() {
        return originalCreateDataChannel.apply(pc, arguments);
      };

      // Override createOffer to mask local IP
      const originalCreateOffer = pc.createOffer.bind(pc);
      pc.createOffer = function(options) {
        return originalCreateOffer(options).then(offer => {
          // Remove IP addresses from SDP
          offer.sdp = offer.sdp.replace(/c=IN IP[46] [\d.a-f:]+/g, 'c=IN IP4 0.0.0.0');
          offer.sdp = offer.sdp.replace(/a=candidate:\d+ \d+ \w+ \d+ [\d.a-f:]+ /g, 'a=candidate:0 0 UDP 0 0.0.0.0 ');
          return offer;
        });
      };

      return pc;
    };

    // Preserve prototype chain
    window.RTCPeerConnection.prototype = originalRTCPeerConnection.prototype;

    // Also block navigator.mediaDevices.getUserMedia IP leaks
    if (navigator.mediaDevices) {
      const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = function(constraints) {
        // Allow audio/video but mask IP info
        return originalGetUserMedia(constraints);
      };
    }
  });

  // 11. HARDWARE FINGERPRINT SPOOFING (Critical for 10/10)
  await page.addInitScript((seed) => {
    const random = (function(s) {
      return function() {
        s = Math.sin(s) * 10000;
        return s - Math.floor(s);
      };
    })(seed * 777777);

    // Randomize hardware concurrency (4-16 cores, common values)
    const cores = [4, 6, 8, 12, 16][Math.floor(random() * 5)];
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => cores
    });

    // Randomize device memory (4-32 GB, common values)
    const memory = [4, 8, 16, 32][Math.floor(random() * 4)];
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => memory
    });

    // Randomize max touch points (0 for desktop, 1-10 for touch)
    Object.defineProperty(navigator, 'maxTouchPoints', {
      get: () => 0 // Desktop browser
    });

    // Platform spoofing
    Object.defineProperty(navigator, 'platform', {
      get: () => 'Win32'
    });

    // Vendor spoofing
    Object.defineProperty(navigator, 'vendor', {
      get: () => 'Google Inc.'
    });

    // Product sub (consistent timestamp)
    Object.defineProperty(navigator, 'productSub', {
      get: () => '20030107'
    });
  }, sessionSeed);

  // 12. AUDIO FINGERPRINT PROTECTION
  await page.addInitScript((seed) => {
    const random = (function(s) {
      return function() {
        s = Math.sin(s) * 10000;
        return s - Math.floor(s);
      };
    })(seed * 666666);

    // Add noise to AudioContext fingerprinting
    const originalCreateAnalyser = AudioContext.prototype.createAnalyser;
    AudioContext.prototype.createAnalyser = function() {
      const analyser = originalCreateAnalyser.apply(this, arguments);
      const originalGetFloatFrequencyData = analyser.getFloatFrequencyData.bind(analyser);

      analyser.getFloatFrequencyData = function(array) {
        originalGetFloatFrequencyData(array);
        // Add tiny noise
        for (let i = 0; i < array.length; i++) {
          array[i] += (random() - 0.5) * 0.0001;
        }
      };

      return analyser;
    };

    // OfflineAudioContext protection
    if (typeof OfflineAudioContext !== 'undefined') {
      const originalOfflineCreateAnalyser = OfflineAudioContext.prototype.createAnalyser;
      OfflineAudioContext.prototype.createAnalyser = function() {
        const analyser = originalOfflineCreateAnalyser.apply(this, arguments);
        const originalGetFloatFrequencyData = analyser.getFloatFrequencyData.bind(analyser);

        analyser.getFloatFrequencyData = function(array) {
          originalGetFloatFrequencyData(array);
          for (let i = 0; i < array.length; i++) {
            array[i] += (random() - 0.5) * 0.0001;
          }
        };

        return analyser;
      };
    }
  }, sessionSeed);

  // 13. CLIENT RECTS FINGERPRINT NOISE
  await page.addInitScript((seed) => {
    const random = (function(s) {
      return function() {
        s = Math.sin(s) * 10000;
        return s - Math.floor(s);
      };
    })(seed * 555555);

    // Add noise to getBoundingClientRect
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function() {
      const rect = originalGetBoundingClientRect.apply(this, arguments);
      const noise = 0.00001;
      return new DOMRect(
        rect.x + (random() - 0.5) * noise,
        rect.y + (random() - 0.5) * noise,
        rect.width + (random() - 0.5) * noise,
        rect.height + (random() - 0.5) * noise
      );
    };

    // Add noise to getClientRects
    const originalGetClientRects = Element.prototype.getClientRects;
    Element.prototype.getClientRects = function() {
      const rects = originalGetClientRects.apply(this, arguments);
      const noise = 0.00001;
      const newRects = [];
      for (let i = 0; i < rects.length; i++) {
        newRects.push(new DOMRect(
          rects[i].x + (random() - 0.5) * noise,
          rects[i].y + (random() - 0.5) * noise,
          rects[i].width + (random() - 0.5) * noise,
          rects[i].height + (random() - 0.5) * noise
        ));
      }
      return newRects;
    };
  }, sessionSeed);

  // 14. FONT ENUMERATION PROTECTION
  await page.addInitScript(() => {
    // Return consistent common fonts only
    if (document.fonts && document.fonts.check) {
      const originalCheck = document.fonts.check.bind(document.fonts);
      const commonFonts = new Set([
        'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia',
        'Impact', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Webdings',
        'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Source Sans Pro'
      ]);

      document.fonts.check = function(font) {
        const fontFamily = font.split(' ').pop().replace(/['"]/g, '');
        if (commonFonts.has(fontFamily)) {
          return originalCheck(font);
        }
        return false; // Report uncommon fonts as unavailable
      };
    }
  });

  // 15. Override toString methods that might reveal automation
  await page.addInitScript(() => {
    const originalToString = Function.prototype.toString;
    Function.prototype.toString = function() {
      if (this === navigator.webdriver) {
        return 'function webdriver() { [native code] }';
      }
      // Hide our modifications
      const result = originalToString.call(this);
      if (result.includes('getParameter') || result.includes('toDataURL')) {
        return 'function () { [native code] }';
      }
      return result;
    };
  });

  // 16. Screen resolution consistency
  await page.addInitScript(() => {
    // Common screen resolutions
    Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
    Object.defineProperty(screen, 'availHeight', { get: () => 1040 }); // 1080 - taskbar
    Object.defineProperty(screen, 'width', { get: () => 1920 });
    Object.defineProperty(screen, 'height', { get: () => 1080 });
    Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
    Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
  });

  // 17. Battery API spoofing (if exists)
  await page.addInitScript(() => {
    if (navigator.getBattery) {
      navigator.getBattery = () => Promise.resolve({
        charging: true,
        chargingTime: 0,
        dischargingTime: Infinity,
        level: 1,
        addEventListener: () => {},
        removeEventListener: () => {}
      });
    }
  });

  // 18. Add realistic mouse movement tracking
  await page.addInitScript(() => {
    window.__mouseHistory = [];
    document.addEventListener('mousemove', (e) => {
      window.__mouseHistory.push({ x: e.clientX, y: e.clientY, time: Date.now() });
      if (window.__mouseHistory.length > 50) {
        window.__mouseHistory.shift();
      }
    });
  });

  logger.debug('✅ ENHANCED stealth techniques applied (10/10 mode)');
}

/**
 * Add human-like mouse movement before clicking
 */
export async function moveMouseHumanLike(page, x, y) {
  // Move mouse in curved path to target position
  const steps = 10 + Math.floor(Math.random() * 5);
  const currentPos = await page.evaluate(() => {
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  });

  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    // Use easing for more natural movement
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    const currentX = currentPos.x + (x - currentPos.x) * eased;
    const currentY = currentPos.y + (y - currentPos.y) * eased;

    // Add slight randomness
    const jitterX = (Math.random() - 0.5) * 3;
    const jitterY = (Math.random() - 0.5) * 3;

    await page.mouse.move(currentX + jitterX, currentY + jitterY);
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
  }
}

// US location profiles for timezone/geolocation matching
const US_LOCATION_PROFILES = [
  { city: 'New York', timezone: 'America/New_York', lat: 40.7128, lng: -74.0060, state: 'NY' },
  { city: 'Los Angeles', timezone: 'America/Los_Angeles', lat: 34.0522, lng: -118.2437, state: 'CA' },
  { city: 'Chicago', timezone: 'America/Chicago', lat: 41.8781, lng: -87.6298, state: 'IL' },
  { city: 'Houston', timezone: 'America/Chicago', lat: 29.7604, lng: -95.3698, state: 'TX' },
  { city: 'Phoenix', timezone: 'America/Phoenix', lat: 33.4484, lng: -112.0740, state: 'AZ' },
  { city: 'Seattle', timezone: 'America/Los_Angeles', lat: 47.6062, lng: -122.3321, state: 'WA' },
  { city: 'Denver', timezone: 'America/Denver', lat: 39.7392, lng: -104.9903, state: 'CO' },
  { city: 'Atlanta', timezone: 'America/New_York', lat: 33.7490, lng: -84.3880, state: 'GA' },
  { city: 'Boston', timezone: 'America/New_York', lat: 42.3601, lng: -71.0589, state: 'MA' },
  { city: 'San Francisco', timezone: 'America/Los_Angeles', lat: 37.7749, lng: -122.4194, state: 'CA' },
];

// Varied Chrome versions and user agent combinations for 10/10 stealth
const USER_AGENT_PROFILES = [
  // Windows profiles (most common)
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', platform: 'Win32', vendor: 'Google Inc.' },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', platform: 'Win32', vendor: 'Google Inc.' },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', platform: 'Win32', vendor: 'Google Inc.' },
  // Mac profiles
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', platform: 'MacIntel', vendor: 'Google Inc.' },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', platform: 'MacIntel', vendor: 'Google Inc.' },
  // Linux profiles (less common but realistic)
  { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', platform: 'Linux x86_64', vendor: 'Google Inc.' },
];

// Common screen resolutions
const SCREEN_RESOLUTIONS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 2560, height: 1440 },
];

/**
 * Create a stealth browser context with realistic settings
 * ENHANCED: 10/10 stealth with location/timezone matching
 * @param {Browser} browser - Playwright browser instance
 * @param {Object} options - Context options
 * @param {string} options.applicationId - Application ID for sticky proxy sessions
 * @param {string} options.jobBoardDomain - Job board domain for proxy selection
 * @param {Object} options.proxy - Override proxy configuration
 * @returns {Promise<BrowserContext>} Stealth browser context
 */
export async function createStealthContext(browser, options = {}) {
  // Select random but consistent profile for this session
  const sessionSeed = options.applicationId
    ? parseInt(options.applicationId.replace(/\D/g, '').slice(0, 8) || '12345', 10)
    : Math.floor(Math.random() * 1000000);

  const seededRandom = (seed) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  // Select location profile (consistent per session)
  const locationProfile = US_LOCATION_PROFILES[Math.floor(seededRandom(sessionSeed) * US_LOCATION_PROFILES.length)];

  // Select user agent profile (consistent per session)
  const uaProfile = USER_AGENT_PROFILES[Math.floor(seededRandom(sessionSeed + 1) * USER_AGENT_PROFILES.length)];

  // Select screen resolution (consistent per session)
  const screenRes = SCREEN_RESOLUTIONS[Math.floor(seededRandom(sessionSeed + 2) * SCREEN_RESOLUTIONS.length)];

  // Add slight randomness to geolocation (within ~1km)
  const geoNoise = 0.01; // ~1km variance
  const latitude = locationProfile.lat + (seededRandom(sessionSeed + 3) - 0.5) * geoNoise;
  const longitude = locationProfile.lng + (seededRandom(sessionSeed + 4) - 0.5) * geoNoise;

  logger.info({
    location: locationProfile.city,
    timezone: locationProfile.timezone,
    resolution: `${screenRes.width}x${screenRes.height}`,
    platform: uaProfile.platform
  }, '🎭 Creating stealth context with matched profile');

  const contextOptions = {
    viewport: { width: screenRes.width, height: screenRes.height },
    userAgent: options.userAgent || uaProfile.ua,
    locale: 'en-US',
    timezoneId: locationProfile.timezone,
    permissions: ['geolocation'],
    geolocation: { latitude, longitude, accuracy: 100 },
    colorScheme: 'light',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
      'Sec-CH-UA': `"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"`,
      'Sec-CH-UA-Mobile': '?0',
      'Sec-CH-UA-Platform': `"${uaProfile.platform.includes('Win') ? 'Windows' : uaProfile.platform.includes('Mac') ? 'macOS' : 'Linux'}"`,
    },
    // Store session seed for stealth page application
    sessionSeed
  };

  // Get proxy configuration - Priority: options.proxy > proxyRotator > env vars
  let proxy = options.proxy;

  if (!proxy && proxyRotator.isConfigured()) {
    // Use proxy rotator for automatic rotation
    if (options.jobBoardDomain && options.applicationId) {
      // Job board specific proxy with sticky session
      proxy = proxyRotator.getProxyForJobBoard(options.jobBoardDomain, options.applicationId);
    } else if (options.applicationId) {
      // Sticky proxy for multi-page forms
      proxy = proxyRotator.getStickyProxy(options.applicationId);
    } else {
      // Rotating proxy (new IP)
      proxy = proxyRotator.getRotatingProxy();
    }
  } else if (!proxy && process.env.PROXY_SERVER) {
    // Fallback to environment variables (legacy support)
    proxy = {
      server: process.env.PROXY_SERVER,
      username: process.env.PROXY_USERNAME,
      password: process.env.PROXY_PASSWORD
    };
  }

  // Add proxy to context if configured
  if (proxy && proxy.server) {
    contextOptions.proxy = proxy;
    logger.info({
      proxyServer: proxy.server,
      hasCredentials: !!proxy.username
    }, '🔒 Proxy configured for browser context');
  }

  // Spread remaining options (but don't override proxy)
  const { applicationId, jobBoardDomain, proxy: _, ...restOptions } = options;
  Object.assign(contextOptions, restOptions);

  const context = await browser.newContext(contextOptions);

  logger.debug({ userAgent: randomUserAgent }, 'Created stealth browser context');
  return context;
}

/**
 * Launch browser via Browserless Cloud (if configured)
 * Provides advanced stealth features and managed infrastructure
 * @param {Object} options - Launch options
 * @returns {Promise<Browser>} Playwright browser instance
 */
export async function launchBrowserlessBrowser(options = {}) {
  const browserlessUrl = process.env.BROWSERLESS_URL || process.env.BROWSERLESS_ENDPOINT;
  const browserlessToken = process.env.BROWSERLESS_TOKEN;
  
  if (!browserlessUrl) {
    throw new Error('BROWSERLESS_URL or BROWSERLESS_ENDPOINT environment variable not set');
  }

  logger.info({ browserlessUrl: browserlessUrl.replace(/\/\/.*@/, '//***@') }, 'Connecting to Browserless Cloud...');

  try {
    // Construct WebSocket URL for Browserless
    // Format: wss://chrome.browserless.io?token=YOUR_TOKEN
    // Or: ws://localhost:3000 (for self-hosted)
    let wsUrl = browserlessUrl;
    
    // If it's an HTTP URL, convert to WebSocket
    if (wsUrl.startsWith('http://')) {
      wsUrl = wsUrl.replace('http://', 'ws://');
    } else if (wsUrl.startsWith('https://')) {
      wsUrl = wsUrl.replace('https://', 'wss://');
    }
    
    // Add token if provided
    if (browserlessToken && !wsUrl.includes('token=')) {
      const separator = wsUrl.includes('?') ? '&' : '?';
      wsUrl = `${wsUrl}${separator}token=${browserlessToken}`;
    }

    // Connect to Browserless Cloud via CDP (Chrome DevTools Protocol)
    const browser = await chromium.connectOverCDP(wsUrl, {
      timeout: 30000
    });

    logger.info('✅ Connected to Browserless Cloud');
    return browser;
  } catch (error) {
    logger.error({ error: error.message, browserlessUrl: browserlessUrl.replace(/\/\/.*@/, '//***@') }, 'Failed to connect to Browserless Cloud');
    throw new Error(`Browserless connection failed: ${error.message}`);
  }
}

// Browser pool state for round-robin selection
let browserPoolIndex = 0;
let cachedBrowserEndpoints = null;
let endpointsCachedAt = 0;
const ENDPOINTS_CACHE_TTL = 30000; // 30 seconds

/**
 * Fetch available browser endpoints from Camoufox service
 * @returns {Promise<string[]>} Array of WebSocket endpoints
 */
async function fetchBrowserEndpoints() {
  const serviceUrl = process.env.CAMOUFOX_SERVICE_URL;

  // Return cached endpoints if still fresh
  if (cachedBrowserEndpoints && (Date.now() - endpointsCachedAt) < ENDPOINTS_CACHE_TTL) {
    return cachedBrowserEndpoints;
  }

  if (serviceUrl) {
    try {
      const response = await fetch(`${serviceUrl}/browsers`);
      if (response.ok) {
        const data = await response.json();
        const endpoints = data.browsers
          .filter(b => b.status === 'ready' && b.endpoint)
          .map(b => b.endpoint);

        if (endpoints.length > 0) {
          cachedBrowserEndpoints = endpoints;
          endpointsCachedAt = Date.now();
          logger.info({ count: endpoints.length }, '🔄 Fetched browser pool endpoints from service');
          return endpoints;
        }
      }
    } catch (e) {
      logger.warn({ error: e.message }, 'Failed to fetch browser endpoints from service');
    }
  }

  // Fallback: Try file-based endpoint (local development)
  const endpointFile = '/tmp/camoufox_endpoint.txt';
  try {
    const fs = await import('fs');
    if (fs.existsSync(endpointFile)) {
      const dynamicEndpoint = fs.readFileSync(endpointFile, 'utf8').trim();
      if (dynamicEndpoint && dynamicEndpoint.startsWith('ws://')) {
        logger.info({ dynamicEndpoint: true }, '📂 Using dynamic endpoint from file');
        return [dynamicEndpoint];
      }
    }
  } catch (e) {
    // File doesn't exist or can't be read
  }

  // Final fallback: Environment variable
  const envEndpoint = process.env.CAMOUFOX_WS_ENDPOINT;
  if (envEndpoint) {
    return [envEndpoint];
  }

  return ['ws://localhost:3000/browser'];
}

/**
 * Select next browser from pool using round-robin
 * @param {string[]} endpoints - Available browser endpoints
 * @returns {string} Selected endpoint
 */
function selectBrowserFromPool(endpoints) {
  if (endpoints.length === 0) {
    throw new Error('No browser endpoints available');
  }

  const endpoint = endpoints[browserPoolIndex % endpoints.length];
  browserPoolIndex = (browserPoolIndex + 1) % endpoints.length;
  return endpoint;
}

/**
 * Launch Camoufox browser via remote WebSocket connection
 * Connects to Python microservice running Camoufox browser server
 * Supports browser pool with automatic failover
 * @param {Object} options - Launch options
 * @returns {Promise<Browser>} Playwright browser instance
 */
export async function launchCamoufoxBrowser(options = {}) {
  // Get available browser endpoints
  const endpoints = await fetchBrowserEndpoints();
  const maxRetries = Math.min(endpoints.length, 3);

  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const wsEndpoint = selectBrowserFromPool(endpoints);

    logger.info({
      wsEndpoint: wsEndpoint.replace(/\/\/.*@/, '//***@'),
      attempt: attempt + 1,
      poolSize: endpoints.length
    }, '🦊 Connecting to Camoufox remote browser (Firefox-based stealth)...');

    try {
      // Connect to Python Camoufox service via WebSocket
      // Camoufox is Firefox-based, so we use firefox.connect() (NOT chromium)
      const browser = await firefox.connect(wsEndpoint, {
        timeout: 30000 // 30 second timeout for connection
      });

      logger.info('✅ Connected to Camoufox browser server successfully');
      logger.info('📌 All auto-apply logic runs in Node.js - Python only provides stealth browser');

      // Add disconnect handler for monitoring
      browser.on('disconnected', () => {
        logger.warn('⚠️ Browser disconnected from Camoufox server');
      });

      return browser;
    } catch (error) {
      lastError = error;
      logger.warn({
        error: error.message,
        endpoint: wsEndpoint.replace(/\/\/.*@/, '//***@'),
        attempt: attempt + 1
      }, '⚠️ Browser connection failed, trying next in pool...');

      // Invalidate cache on connection failure
      cachedBrowserEndpoints = null;
    }
  }

  logger.error({
    error: lastError?.message,
    attempts: maxRetries
  }, '❌ Failed to connect to any Camoufox browser in pool');

  throw new Error(`Camoufox connection failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Create stealth context for Camoufox browser
 * Includes proxy support and realistic browser fingerprinting
 * @param {Browser} browser - Camoufox browser instance
 * @param {Object} options - Context options
 * @param {string} options.applicationId - Application ID for sticky proxy sessions
 * @param {string} options.jobBoardDomain - Job board domain for proxy selection
 * @param {Object} options.proxy - Override proxy configuration
 * @returns {Promise<BrowserContext>} Stealth browser context
 */
export async function createStealthContextCamoufox(browser, options = {}) {
  // Use consistent session seed for profile selection (same logic as createStealthContext)
  const sessionSeed = options.sessionSeed || (options.applicationId
    ? parseInt(options.applicationId.replace(/\D/g, '').slice(0, 8) || '12345', 10)
    : Math.floor(Math.random() * 1000000));

  const seededRandom = (seed) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  // Select location profile (consistent per session) - uses same US_LOCATION_PROFILES
  const locationProfile = US_LOCATION_PROFILES[Math.floor(seededRandom(sessionSeed) * US_LOCATION_PROFILES.length)];

  // Select screen resolution (consistent per session)
  const screenRes = SCREEN_RESOLUTIONS[Math.floor(seededRandom(sessionSeed + 2) * SCREEN_RESOLUTIONS.length)];

  // Add slight randomness to geolocation (within ~1km)
  const geoNoise = 0.01;
  const latitude = locationProfile.lat + (seededRandom(sessionSeed + 3) - 0.5) * geoNoise;
  const longitude = locationProfile.lng + (seededRandom(sessionSeed + 4) - 0.5) * geoNoise;

  // Firefox user agents for Camoufox (varied versions)
  const firefoxUserAgents = [
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0', platform: 'Win32' },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0', platform: 'Win32' },
    { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0', platform: 'MacIntel' },
    { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0', platform: 'MacIntel' },
    { ua: 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0', platform: 'Linux x86_64' },
  ];

  const uaProfile = firefoxUserAgents[Math.floor(seededRandom(sessionSeed + 1) * firefoxUserAgents.length)];

  logger.info({
    location: locationProfile.city,
    timezone: locationProfile.timezone,
    resolution: `${screenRes.width}x${screenRes.height}`,
    platform: uaProfile.platform
  }, '🦊 Creating Camoufox context with matched profile');

  const contextOptions = {
    viewport: { width: screenRes.width, height: screenRes.height },
    userAgent: options.userAgent || uaProfile.ua,
    locale: 'en-US',
    timezoneId: locationProfile.timezone,
    permissions: ['geolocation'],
    geolocation: { latitude, longitude, accuracy: 100 },
    colorScheme: 'light',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
    }
  };

  // NOTE: Firefox/Camoufox has issues with Playwright-level proxy authentication
  // Camoufox provides C++-level stealth which is more effective than proxy rotation.
  // Proxy should be configured at the Python Camoufox server level if needed.
  logger.info('🦊 Camoufox context created (stealth provided at browser level)');

  // Spread remaining options (but don't override proxy or sessionSeed)
  const { applicationId, jobBoardDomain, proxy: _, sessionSeed: __, ...restOptions } = options;
  Object.assign(contextOptions, restOptions);

  const context = await browser.newContext(contextOptions);

  logger.debug({ userAgent: uaProfile.ua, location: locationProfile.city }, 'Created Camoufox stealth context');
  return context;
}

/**
 * Launch browser for stealth mode (auto-apply, form filling)
 * Includes comprehensive bot detection evasion
 * Priority: Camoufox → Browserless Cloud → Local Playwright
 */
export async function launchStealthBrowser(options = {}) {
  // Priority 1: Check if Camoufox is configured
  const useCamoufox = process.env.USE_CAMOUFOX === 'true';

  if (useCamoufox) {
    logger.info('🦊 Using Camoufox for maximum stealth (C++ level detection evasion)');
    try {
      const browser = await launchCamoufoxBrowser(options);
      logger.info('✅ Camoufox browser connected successfully');
      return browser;
    } catch (error) {
      logger.warn({
        error: error.message
      }, '⚠️ Camoufox connection failed, falling back to Browserless/local');
      // Fall through to next option
    }
  }

  // Priority 2: Check if Browserless Cloud is configured
  const useBrowserless = process.env.USE_BROWSERLESS === 'true' ||
                         process.env.BROWSERLESS_URL ||
                         process.env.BROWSERLESS_ENDPOINT;

  if (useBrowserless) {
    logger.info('Using Browserless Cloud for enhanced stealth');
    try {
      const browser = await launchBrowserlessBrowser(options);
      logger.info('✅ Browserless Cloud browser launched');
      return browser;
    } catch (error) {
      logger.warn({ error: error.message }, 'Browserless Cloud failed, falling back to local browser');
      // Fall through to local browser
    }
  }

  // Priority 3: Use local browser with stealth techniques
  const browser = await launchBrowser({
    ...options,
    stealth: true,
    headless: options.headless !== undefined ? options.headless : process.env.PLAYWRIGHT_HEADLESS !== 'false'
  });

  logger.info('✅ Stealth browser launched with bot detection evasion');
  return browser;
}

/**
 * Launch browser for pooling (multiple instances)
 */
export async function launchPooledBrowser(options = {}) {
  return launchBrowser({
    ...options,
    headless: true,
    extraArgs: [
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--disable-images',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-component-extensions-with-background-pages',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--disable-renderer-backgrounding',
      '--enable-features=NetworkService,NetworkServiceInProcess',
      '--force-color-profile=srgb',
      '--hide-scrollbars',
      '--metrics-recording-only',
      '--mute-audio'
    ]
  });
}

/**
 * Human Behavior Simulation
 * Adds realistic human-like interactions to avoid bot detection
 */

/**
 * Random delay with human-like timing variance
 * @param {number} min - Minimum delay in ms (default: 1000)
 * @param {number} max - Maximum delay in ms (default: 3000)
 */
export async function humanDelay(min = 1000, max = 3000) {
  const delay = min + Math.random() * (max - min);
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Simulate random scrolling like a human reading a page
 * @param {Page} page - Playwright page
 * @param {Object} options - Scroll options
 */
export async function humanScroll(page, options = {}) {
  const scrolls = options.scrolls || (2 + Math.floor(Math.random() * 3)); // 2-4 scrolls

  logger.debug(`Simulating ${scrolls} human-like scrolls`);

  for (let i = 0; i < scrolls; i++) {
    // Scroll down a random amount (200-800px)
    const scrollAmount = 200 + Math.random() * 600;

    await page.evaluate((amount) => {
      window.scrollBy({
        top: amount,
        left: 0,
        behavior: 'smooth'
      });
    }, scrollAmount);

    // Wait a bit (simulating reading)
    await humanDelay(500, 1500);

    // Occasionally scroll up a bit (like re-reading)
    if (Math.random() > 0.7) {
      const scrollBack = 50 + Math.random() * 150;
      await page.evaluate((amount) => {
        window.scrollBy({
          top: -amount,
          left: 0,
          behavior: 'smooth'
        });
      }, scrollBack);
      await humanDelay(300, 800);
    }
  }

  logger.debug('✅ Human-like scrolling complete');
}

/**
 * Random mouse movements to simulate human presence
 * @param {Page} page - Playwright page
 * @param {number} movements - Number of random movements (default: 3-5)
 */
export async function randomMouseJiggles(page, movements = null) {
  const numMovements = movements || (3 + Math.floor(Math.random() * 3));

  logger.debug(`Performing ${numMovements} random mouse movements`);

  for (let i = 0; i < numMovements; i++) {
    const x = 100 + Math.random() * 1720; // Random X within 1920px width
    const y = 100 + Math.random() * 880;  // Random Y within 1080px height

    await moveMouseHumanLike(page, x, y);
    await humanDelay(300, 1000);
  }

  logger.debug('✅ Random mouse movements complete');
}

/**
 * Type text like a human (with realistic delays and occasional typos)
 * @param {Page} page - Playwright page
 * @param {string} selector - Input field selector
 * @param {string} text - Text to type
 * @param {Object} options - Typing options
 */
export async function humanType(page, selector, text, options = {}) {
  const element = await page.$(selector);
  if (!element) {
    logger.warn(`Element not found: ${selector}`);
    return false;
  }

  // Clear existing content first
  await element.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');

  // Type with human-like delays
  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Occasional typo (5% chance) - type wrong char then backspace
    if (Math.random() < 0.05 && i < text.length - 1) {
      const wrongChar = String.fromCharCode(65 + Math.floor(Math.random() * 26));
      await page.keyboard.type(wrongChar);
      await humanDelay(100, 300);
      await page.keyboard.press('Backspace');
      await humanDelay(50, 150);
    }

    // Type the correct character
    await page.keyboard.type(char);

    // Variable typing speed (30-150ms between keys)
    // Faster for common keys, slower for special chars
    const isSpace = char === ' ';
    const isPunctuation = /[.,!?;:]/.test(char);

    let delay = 30 + Math.random() * 50; // Base delay: 30-80ms
    if (isSpace) delay += 50; // Longer pause after space
    if (isPunctuation) delay += 30; // Slightly longer for punctuation

    await new Promise(resolve => setTimeout(resolve, delay));
  }

  logger.debug(`✅ Typed text into ${selector} with human-like behavior`);
  return true;
}

/**
 * Simulate complete human page visit behavior
 * Includes: scrolling, mouse movements, random pauses
 * @param {Page} page - Playwright page
 * @param {Object} options - Behavior options
 */
export async function simulateHumanPageVisit(page, options = {}) {
  logger.info('🤖 Simulating human page visit behavior...');

  // Initial pause (like reading the page title/header)
  await humanDelay(800, 1500);

  // Random mouse movements (like moving cursor while reading)
  await randomMouseJiggles(page, 2);

  // Scroll down to explore the page
  await humanScroll(page, { scrolls: options.scrolls || 2 });

  // More mouse movements
  await randomMouseJiggles(page, 1);

  // Final pause before interaction
  await humanDelay(500, 1200);

  logger.info('✅ Human behavior simulation complete');
}

// Re-export proxy rotator for convenience
export { default as proxyRotator } from './proxy-rotator.js';

export default {
  launchBrowser,
  launchStealthBrowser,
  launchPooledBrowser,
  launchBrowserlessBrowser,
  launchCamoufoxBrowser,
  applyStealthToPage,
  createStealthContext,
  createStealthContextCamoufox,
  moveMouseHumanLike,
  humanDelay,
  humanScroll,
  randomMouseJiggles,
  humanType,
  simulateHumanPageVisit,
  proxyRotator
};
