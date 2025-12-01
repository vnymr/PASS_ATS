/**
 * Ghost Cursor Integration for Playwright
 *
 * Provides human-like mouse movements using Bezier curves and Fitts's Law
 * to evade bot detection systems like DataDome, Cloudflare, PerimeterX.
 *
 * Based on ghost-cursor library principles, adapted for Playwright.
 */

import { path as ghostPath } from 'ghost-cursor';
import logger from './logger.js';

/**
 * Create a cursor controller for a Playwright page
 * @param {Page} page - Playwright page instance
 * @param {Object} options - Cursor options
 * @returns {Object} Cursor controller with human-like movement methods
 */
export function createCursor(page, options = {}) {
  // Track current mouse position
  let currentPosition = options.start || { x: 0, y: 0 };

  // Movement speed factors (lower = slower, more human-like)
  const moveSpeed = options.moveSpeed || 1.0;
  const moveSteps = options.moveSteps || 25;

  // Overshoot settings (humans often overshoot targets slightly)
  const overshootSpread = options.overshootSpread || 10;
  const overshootRadius = options.overshootRadius || 5;

  /**
   * Generate Bezier curve path between two points
   * Uses ghost-cursor's path generation algorithm
   */
  function generatePath(start, end) {
    try {
      // Use ghost-cursor's path generation (Bezier + Fitts's Law)
      return ghostPath(start, end, {
        spreadOverride: overshootSpread,
        moveSpeed: moveSpeed
      });
    } catch (error) {
      // Fallback to simple curved path if ghost-cursor fails
      logger.debug({ error: error.message }, 'Ghost cursor path failed, using fallback');
      return generateFallbackPath(start, end);
    }
  }

  /**
   * Fallback path generation using quadratic Bezier curves
   */
  function generateFallbackPath(start, end) {
    const steps = moveSteps;
    const path = [];

    // Add random control point for curve (mimics hand movement)
    const cpX = (start.x + end.x) / 2 + (Math.random() - 0.5) * 100;
    const cpY = (start.y + end.y) / 2 + (Math.random() - 0.5) * 100;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;

      // Quadratic Bezier curve
      const x = Math.pow(1 - t, 2) * start.x +
                2 * (1 - t) * t * cpX +
                Math.pow(t, 2) * end.x;
      const y = Math.pow(1 - t, 2) * start.y +
                2 * (1 - t) * t * cpY +
                Math.pow(t, 2) * end.y;

      // Add tiny jitter (hand tremor)
      const jitterX = (Math.random() - 0.5) * 2;
      const jitterY = (Math.random() - 0.5) * 2;

      path.push({ x: x + jitterX, y: y + jitterY });
    }

    return path;
  }

  /**
   * Add human-like timing variation between movements
   * Based on Fitts's Law: MT = a + b * log2(2D/W)
   */
  function getMovementDelay(distance) {
    // Base delay + distance-based delay (Fitts's Law approximation)
    const baseDelay = 1 + Math.random() * 3; // 1-4ms base
    const distanceFactor = Math.log2(Math.max(1, distance / 50));
    return baseDelay + distanceFactor * 2;
  }

  /**
   * Simulate human overshoot behavior
   * Humans often slightly overshoot their target, then correct
   */
  function shouldOvershoot(distance) {
    // Overshoot more likely for longer distances
    if (distance < 100) return false;
    return Math.random() < 0.3; // 30% chance for distances > 100px
  }

  /**
   * Get overshoot position
   */
  function getOvershootPosition(target, distance) {
    // Overshoot by 5-15 pixels past the target
    const overshootAmount = overshootRadius + Math.random() * 10;
    const angle = Math.random() * Math.PI * 2;

    return {
      x: target.x + Math.cos(angle) * overshootAmount,
      y: target.y + Math.sin(angle) * overshootAmount
    };
  }

  /**
   * Move mouse to coordinates with human-like behavior
   * @param {Object} target - Target coordinates { x, y }
   * @param {Object} options - Movement options
   */
  async function moveTo(target, moveOptions = {}) {
    const start = { ...currentPosition };
    const end = { x: target.x, y: target.y };

    // Calculate distance for timing
    const distance = Math.sqrt(
      Math.pow(end.x - start.x, 2) +
      Math.pow(end.y - start.y, 2)
    );

    // Check if we should overshoot
    const doOvershoot = moveOptions.overshoot !== false && shouldOvershoot(distance);

    if (doOvershoot) {
      // First move past the target
      const overshootPos = getOvershootPosition(end, distance);
      const overshootPath = generatePath(start, overshootPos);

      for (const point of overshootPath) {
        await page.mouse.move(point.x, point.y);
        const delay = getMovementDelay(10);
        await new Promise(r => setTimeout(r, delay));
      }

      // Brief pause (realizing we overshot)
      await new Promise(r => setTimeout(r, 50 + Math.random() * 100));

      // Correct back to target
      const correctionPath = generatePath(overshootPos, end);
      for (const point of correctionPath) {
        await page.mouse.move(point.x, point.y);
        const delay = getMovementDelay(5) * 0.7; // Slightly faster correction
        await new Promise(r => setTimeout(r, delay));
      }
    } else {
      // Direct movement with curve
      const path = generatePath(start, end);

      for (const point of path) {
        await page.mouse.move(point.x, point.y);
        const delay = getMovementDelay(distance / path.length);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    // Update current position
    currentPosition = { x: end.x, y: end.y };

    logger.debug({ from: start, to: end, distance, overshoot: doOvershoot }, 'Human-like mouse movement');
  }

  /**
   * Move to an element and click it
   * @param {string} selector - Element selector
   * @param {Object} options - Click options
   */
  async function click(selector, clickOptions = {}) {
    try {
      // Get element bounding box
      const element = await page.$(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }

      const box = await element.boundingBox();
      if (!box) {
        throw new Error(`Element not visible: ${selector}`);
      }

      // Calculate click position (randomized within element)
      const paddingX = box.width * 0.2; // 20% padding from edges
      const paddingY = box.height * 0.2;

      const targetX = box.x + paddingX + Math.random() * (box.width - 2 * paddingX);
      const targetY = box.y + paddingY + Math.random() * (box.height - 2 * paddingY);

      // Move to element
      await moveTo({ x: targetX, y: targetY }, clickOptions);

      // Pre-click hesitation (natural pause before clicking)
      await new Promise(r => setTimeout(r, 50 + Math.random() * 150));

      // Perform click with realistic timing
      await page.mouse.down();
      await new Promise(r => setTimeout(r, 20 + Math.random() * 80)); // Hold duration
      await page.mouse.up();

      // Post-click pause
      await new Promise(r => setTimeout(r, 100 + Math.random() * 200));

      logger.debug({ selector, x: targetX, y: targetY }, 'Human-like click performed');

      return true;
    } catch (error) {
      logger.warn({ selector, error: error.message }, 'Click failed');
      throw error;
    }
  }

  /**
   * Double click an element
   * @param {string} selector - Element selector
   */
  async function doubleClick(selector) {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    const box = await element.boundingBox();
    if (!box) {
      throw new Error(`Element not visible: ${selector}`);
    }

    const targetX = box.x + box.width / 2 + (Math.random() - 0.5) * 10;
    const targetY = box.y + box.height / 2 + (Math.random() - 0.5) * 10;

    await moveTo({ x: targetX, y: targetY });

    // Double click with human timing
    await page.mouse.down();
    await new Promise(r => setTimeout(r, 30 + Math.random() * 50));
    await page.mouse.up();
    await new Promise(r => setTimeout(r, 100 + Math.random() * 150)); // Gap between clicks
    await page.mouse.down();
    await new Promise(r => setTimeout(r, 30 + Math.random() * 50));
    await page.mouse.up();

    logger.debug({ selector }, 'Human-like double-click performed');
  }

  /**
   * Move to an element (without clicking)
   * @param {string} selector - Element selector
   */
  async function move(selector, moveOptions = {}) {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    const box = await element.boundingBox();
    if (!box) {
      throw new Error(`Element not visible: ${selector}`);
    }

    const targetX = box.x + box.width / 2 + (Math.random() - 0.5) * 20;
    const targetY = box.y + box.height / 2 + (Math.random() - 0.5) * 10;

    await moveTo({ x: targetX, y: targetY }, moveOptions);

    return true;
  }

  /**
   * Type text with human-like characteristics
   * @param {string} text - Text to type
   * @param {Object} options - Typing options
   */
  async function type(text, typeOptions = {}) {
    const typoChance = typeOptions.typoChance || 0.02; // 2% typo rate
    const fixTypos = typeOptions.fixTypos !== false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Occasional typo
      if (Math.random() < typoChance && fixTypos) {
        // Type wrong character
        const wrongChar = String.fromCharCode(
          char.charCodeAt(0) + (Math.random() > 0.5 ? 1 : -1)
        );
        await page.keyboard.type(wrongChar);

        // Pause (noticing mistake)
        await new Promise(r => setTimeout(r, 100 + Math.random() * 300));

        // Delete it
        await page.keyboard.press('Backspace');
        await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
      }

      // Type the correct character
      await page.keyboard.type(char);

      // Variable delay based on character
      let delay = 30 + Math.random() * 70; // Base: 30-100ms

      if (char === ' ') {
        delay += 30; // Longer pause after words
      } else if (/[.,!?]/.test(char)) {
        delay += 100; // Longer pause after punctuation
      } else if (char.toUpperCase() === char && /[A-Z]/.test(char)) {
        delay += 20; // Shift key adds delay
      }

      await new Promise(r => setTimeout(r, delay));
    }

    logger.debug({ length: text.length }, 'Human-like typing completed');
  }

  /**
   * Scroll page with human-like behavior
   * @param {Object} options - Scroll options
   */
  async function scroll(scrollOptions = {}) {
    const direction = scrollOptions.direction || 'down';
    const amount = scrollOptions.amount || (300 + Math.random() * 400);
    const smooth = scrollOptions.smooth !== false;

    const steps = smooth ? 10 : 1;
    const stepAmount = amount / steps;

    for (let i = 0; i < steps; i++) {
      const scrollY = direction === 'down' ? stepAmount : -stepAmount;

      // Add slight horizontal wobble (natural scroll behavior)
      const scrollX = (Math.random() - 0.5) * 5;

      await page.mouse.wheel({ deltaX: scrollX, deltaY: scrollY });

      if (smooth) {
        await new Promise(r => setTimeout(r, 20 + Math.random() * 30));
      }
    }

    // Natural pause after scrolling
    await new Promise(r => setTimeout(r, 200 + Math.random() * 400));

    logger.debug({ direction, amount }, 'Human-like scroll performed');
  }

  /**
   * Perform random idle movements (simulates distraction/reading)
   * @param {number} duration - Duration in ms
   */
  async function idle(duration = 2000) {
    const endTime = Date.now() + duration;

    while (Date.now() < endTime) {
      // Small random movement
      const newX = currentPosition.x + (Math.random() - 0.5) * 50;
      const newY = currentPosition.y + (Math.random() - 0.5) * 30;

      // Clamp to viewport
      const clampedX = Math.max(50, Math.min(1870, newX));
      const clampedY = Math.max(50, Math.min(1030, newY));

      await moveTo({ x: clampedX, y: clampedY }, { overshoot: false });

      // Random pause
      await new Promise(r => setTimeout(r, 500 + Math.random() * 1500));
    }

    logger.debug({ duration }, 'Idle movement simulation completed');
  }

  /**
   * Get current cursor position
   */
  function getPosition() {
    return { ...currentPosition };
  }

  /**
   * Set cursor position (without animation)
   */
  function setPosition(pos) {
    currentPosition = { x: pos.x, y: pos.y };
  }

  return {
    moveTo,
    move,
    click,
    doubleClick,
    type,
    scroll,
    idle,
    getPosition,
    setPosition
  };
}

/**
 * Enhanced click with ghost cursor
 * @param {Page} page - Playwright page
 * @param {string} selector - Element selector
 * @param {Object} options - Click options
 */
export async function ghostClick(page, selector, options = {}) {
  const cursor = createCursor(page, options);
  return cursor.click(selector, options);
}

/**
 * Enhanced type with ghost cursor
 * @param {Page} page - Playwright page
 * @param {string} selector - Element selector (to click first)
 * @param {string} text - Text to type
 * @param {Object} options - Type options
 */
export async function ghostType(page, selector, text, options = {}) {
  const cursor = createCursor(page, options);

  // Click the input field first
  await cursor.click(selector);

  // Small pause before typing
  await new Promise(r => setTimeout(r, 100 + Math.random() * 200));

  // Clear existing content
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await new Promise(r => setTimeout(r, 50 + Math.random() * 100));

  // Type the text
  await cursor.type(text, options);

  return true;
}

/**
 * Simulate human browsing behavior on a page
 * @param {Page} page - Playwright page
 * @param {Object} options - Behavior options
 */
export async function simulateHumanBrowsing(page, options = {}) {
  const cursor = createCursor(page, options);

  logger.info('Simulating human browsing behavior...');

  // Initial page load behavior
  await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));

  // Random mouse movements (reading the page)
  for (let i = 0; i < 3; i++) {
    const randomX = 100 + Math.random() * 1720;
    const randomY = 100 + Math.random() * 880;
    await cursor.moveTo({ x: randomX, y: randomY }, { overshoot: false });
    await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
  }

  // Scroll down
  await cursor.scroll({ direction: 'down', amount: 300 + Math.random() * 300 });

  // More random movements
  for (let i = 0; i < 2; i++) {
    const randomX = 100 + Math.random() * 1720;
    const randomY = 200 + Math.random() * 700;
    await cursor.moveTo({ x: randomX, y: randomY }, { overshoot: false });
    await new Promise(r => setTimeout(r, 300 + Math.random() * 700));
  }

  logger.info('Human browsing simulation complete');
}

export default {
  createCursor,
  ghostClick,
  ghostType,
  simulateHumanBrowsing
};
