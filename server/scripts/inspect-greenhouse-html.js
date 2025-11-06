const { chromium } = require('playwright');

async function inspectHTML() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://job-boards.greenhouse.io/nubank/jobs/7345028', {
    waitUntil: 'networkidle'
  });

  console.log('\n=== INSPECTING GREENHOUSE FORM HTML ===\n');

  const analysis = await page.evaluate(() => {
    // Find all elements that LOOK like dropdowns (have dropdown arrow, show "Select...")
    const allInputs = document.querySelectorAll('input, select, textarea');
    const dropdownCandidates = [];

    allInputs.forEach((el, idx) => {
      const info = {
        index: idx,
        tagName: el.tagName,
        type: el.type || 'N/A',
        name: el.name || 'N/A',
        id: el.id || 'N/A',
        value: el.value || '',
        placeholder: el.placeholder || '',
        class: el.className || '',
        // Check if it looks like a dropdown
        hasSelectClass: el.className.includes('select') || el.className.includes('dropdown'),
        parentClass: el.parentElement?.className || '',
        nearbyText: el.parentElement?.textContent?.substring(0, 100) || ''
      };

      // If it's a select, capture options
      if (el.tagName === 'SELECT') {
        info.isNativeSelect = true;
        info.optionCount = el.querySelectorAll('option').length;
        info.firstOption = el.querySelector('option')?.textContent;
      }

      // If it shows "Select..." it's probably a dropdown
      if (info.value === 'Select...' || info.placeholder === 'Select...' ||
          info.nearbyText.includes('Select...')) {
        dropdownCandidates.push(info);
      }

      // Also capture all selects regardless
      if (el.tagName === 'SELECT') {
        dropdownCandidates.push(info);
      }
    });

    return {
      totalFields: allInputs.length,
      selectElements: Array.from(document.querySelectorAll('select')).length,
      textInputs: Array.from(document.querySelectorAll('input[type="text"]')).length,
      dropdownCandidates: dropdownCandidates
    };
  });

  console.log(`Total form fields: ${analysis.totalFields}`);
  console.log(`Native <select> elements: ${analysis.selectElements}`);
  console.log(`Text <input> elements: ${analysis.textInputs}`);
  console.log(`\nDropdown candidates (${analysis.dropdownCandidates.length}):`);

  analysis.dropdownCandidates.forEach(d => {
    console.log(`\n  ${d.index}: <${d.tagName}> ${d.isNativeSelect ? '✅ NATIVE SELECT' : '❌ NOT SELECT'}`);
    console.log(`     Type: ${d.type}`);
    console.log(`     Name: ${d.name}`);
    console.log(`     ID: ${d.id}`);
    console.log(`     Value: "${d.value}"`);
    if (d.isNativeSelect) {
      console.log(`     Options: ${d.optionCount}, First: "${d.firstOption}"`);
    }
  });

  console.log('\n\n=== Press Ctrl+C to close ===\n');
  await new Promise(resolve => {});
}

inspectHTML().catch(console.error);
