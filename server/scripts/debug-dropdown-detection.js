const { chromium } = require('playwright');

async function debugDropdowns() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://job-boards.greenhouse.io/nubank/jobs/7345028', {
    waitUntil: 'networkidle'
  });

  console.log('\n=== DEBUGGING DROPDOWN DETECTION ===\n');

  // Extract all form fields with their actual HTML structure
  const fieldInfo = await page.evaluate(() => {
    const selects = document.querySelectorAll('select');
    const inputs = document.querySelectorAll('input[type="text"]');

    return {
      selectElements: Array.from(selects).map((sel, idx) => ({
        index: idx,
        tagName: sel.tagName,
        type: sel.type,
        name: sel.name,
        id: sel.id,
        className: sel.className,
        hasOptions: sel.querySelectorAll('option').length,
        firstOptionText: sel.querySelector('option')?.textContent,
        selector: sel.id ? `#${sel.id}` : sel.name ? `select[name="${sel.name}"]` : `select:nth-of-type(${idx + 1})`
      })),
      textInputs: Array.from(inputs).map((inp, idx) => ({
        index: idx,
        tagName: inp.tagName,
        type: inp.type,
        name: inp.name,
        id: inp.id,
        className: inp.className,
        placeholder: inp.placeholder,
        value: inp.value
      }))
    };
  });

  console.log(`Found ${fieldInfo.selectElements.length} <select> elements:`);
  fieldInfo.selectElements.forEach(sel => {
    console.log(`  ${sel.index}: ${sel.selector}`);
    console.log(`     Type: ${sel.type}, Options: ${sel.hasOptions}, First: "${sel.firstOptionText}"`);
  });

  console.log(`\nFound ${fieldInfo.textInputs.length} text inputs`);

  console.log('\n=== Press Ctrl+C to close ===');

  await new Promise(resolve => setTimeout(resolve, 60000));
  await browser.close();
}

debugDropdowns().catch(console.error);
