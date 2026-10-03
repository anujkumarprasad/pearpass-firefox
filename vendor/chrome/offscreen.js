;(function () {
  ;('use strict')
  chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
    if (msg.type === 'CLEAR_CLIPBOARD_NOW') {
      writeFallback(' ')
      sendResponse({ success: true })
      return true
    }
    return false
  })

  function writeFallback(text) {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'

    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
})()
