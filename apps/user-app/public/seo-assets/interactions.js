const formatInr = (value) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.max(0, value))

const amountInput = document.querySelector('input[aria-label="USDT amount"]')
const amountSlider = document.querySelector('input[aria-label="USDT amount slider"]')
const receiveOutput = [...document.querySelectorAll('p')].find((node) =>
  /^₹[\d,]+$/.test(node.textContent.trim()),
)
const rateButtons = [...document.querySelectorAll('button')].filter((button) =>
  /₹(?:112|114|116)/.test(button.textContent),
)

let activeRate = 116

function updateCalculator(source) {
  const value = Number(source?.value || amountInput?.value || amountSlider?.value || 0)
  if (amountInput && source !== amountInput) amountInput.value = value
  if (amountSlider && source !== amountSlider) amountSlider.value = value
  if (receiveOutput) receiveOutput.textContent = `₹${formatInr(value * activeRate)}`
}

amountInput?.addEventListener('input', () => updateCalculator(amountInput))
amountSlider?.addEventListener('input', () => updateCalculator(amountSlider))

rateButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const rate = Number(button.textContent.match(/₹(112|114|116)/)?.[1])
    if (!rate) return
    activeRate = rate
    rateButtons.forEach((item) => item.classList.remove('seo-rate-active'))
    button.classList.add('seo-rate-active')
    updateCalculator(amountInput || amountSlider)
  })
})

const faqAnswers = {
  'What is Miller Pay (MillerPay)?':
    'Miller Pay is an Indian USDT to INR exchange and UPI order platform. You can sell USDT at ₹112–₹116 or process INR orders and earn 4% + 2% = 6% commission. The official website is millerpay-app.online.',
  'What is the official Miller Pay login link?':
    'The only official Miller Pay login is millerpay-app.online. Always check the domain before entering your phone number and password.',
  'How do I download the Miller Pay app / APK?':
    "Miller Pay runs as a web app. Open millerpay-app.online in Chrome and tap 'Add to Home screen' to install it without a separate Play Store download.",
  "What is today's USDT rate on Miller Pay?":
    '₹116 per USDT on the premium UPI wallet tier, ₹114 on IMPS and ₹112 on standard bank settlement. The rate is locked when you confirm your order.',
  'How is the 6% INR order commission calculated?':
    'Every completed INR order earns 4% base commission plus a 2% settlement bonus, for a total of 6%.',
  'How fast are Miller Pay payouts?':
    'Most UPI and IMPS payouts settle within minutes. Bank settlement can take longer during banking off-hours.',
  'Which wallets does Miller Pay support?':
    'Paytm, PhonePe, Mobikwik, Freecharge, Moneyview, Navi, Airtel and IndusPay are listed alongside direct Indian bank transfer.',
  'Is Miller Pay safe?':
    'Deposit wallets use TRC20 and BEP20 networks, and support is available through the official Miller Pay channel.',
}

document.querySelectorAll('#faq button').forEach((button) => {
  const question = button.textContent.trim()
  const answer = faqAnswers[question]
  if (!answer) return
  button.setAttribute('aria-expanded', 'false')
  button.addEventListener('click', () => {
    const heading = button.closest('h3') || button.parentElement
    let panel = heading?.nextElementSibling
    if (!panel?.classList.contains('seo-faq-answer')) {
      panel = document.createElement('p')
      panel.className = 'seo-faq-answer'
      panel.textContent = answer
      panel.hidden = true
      heading?.after(panel)
    }
    panel.hidden = !panel.hidden
    button.setAttribute('aria-expanded', String(!panel.hidden))
  })
})

updateCalculator(amountInput || amountSlider)
