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

updateCalculator(amountInput || amountSlider)
