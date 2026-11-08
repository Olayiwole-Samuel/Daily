// A tiny "tap" you can feel. Call it from a click/tap handler.
//
// Android browsers support navigator.vibrate. iPhones don't, but since iOS 18,
// Safari plays the system haptic when an <input type="checkbox" switch> is toggled.
// So on iOS we make an invisible switch, click it, and throw it away.
// On anything else this quietly does nothing.

const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

export function haptic(): void {
  try {
    if (!isIOS) {
      navigator.vibrate?.(12);
      return;
    }
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    document.body.appendChild(label);
    label.click();
    label.remove();
  } catch {
    // Haptics are a nice-to-have; never let them break a tap.
  }
}
