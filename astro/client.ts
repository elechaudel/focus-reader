// In the browser, for <FocusReader>: registers <focus-reader>, then shows each opening button (hidden without
// JavaScript, as there would be nothing to open) and opens its reader on a click.
import type { FocusReader } from '../src/element.ts';
import '../src/register.ts';

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-focus-reader-open]:not([data-wired])')) {
  button.dataset.wired = '';
  button.hidden = false;
  button.addEventListener('click', () => (document.getElementById(button.dataset.focusReaderOpen!) as FocusReader | null)?.open());
}
