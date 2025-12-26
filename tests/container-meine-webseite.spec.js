const { test, expect } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

test('gtm-container-meine-webseite.json contains GA4 and Ads tags & consent trigger', async () => {
  const p = path.resolve(__dirname, '..', 'gtm-container-meine-webseite.json')
  const raw = fs.readFileSync(p, 'utf8')
  const data = JSON.parse(raw)
  const tags = data && data.containerVersion && data.containerVersion.tag
  const triggers = data && data.containerVersion && data.containerVersion.trigger
  const variables = data && data.containerVersion && data.containerVersion.variable

  expect(Array.isArray(tags)).toBeTruthy()
  expect(tags.some(t => t.name && t.name.includes('GA4 - Configuration'))).toBeTruthy()
  expect(tags.some(t => t.name && t.name.includes('GA4 - Page View'))).toBeTruthy()
  expect(tags.some(t => t.name && t.name.includes('Google Ads - Conversion'))).toBeTruthy()

  expect(Array.isArray(triggers)).toBeTruthy()
  expect(triggers.some(tr => tr.name === 'Consent Granted')).toBeTruthy()
  expect(triggers.some(tr => tr.name === 'Page Metadata Ready')).toBeTruthy()

  expect(Array.isArray(variables)).toBeTruthy()
  expect(variables.some(v => v.name === 'GA4_MEASUREMENT_ID')).toBeTruthy()
  expect(variables.some(v => v.name === 'AW_CONVERSION_ID')).toBeTruthy()
  // ensure AW id value matches the confirmed one
  const awVar = variables.find(v => v.name === 'AW_CONVERSION_ID')
  const awValue = awVar && awVar.parameter && awVar.parameter.find(p => p.key === 'value') && awVar.parameter.find(p => p.key === 'value').value
  expect(awValue).toBe('AW-17819941793')
})