// Copy buttons, wherever they are: `data-copy` holds the text to copy, or `data-copy-from` the id of the element
// whose text it is. A copy shows "Copied" for a moment; the `done` class lets the button change colour meanwhile.
function flash(b: HTMLElement, text: string) {
  const before = b.textContent;
  b.textContent = text;
  b.classList.add('done');
  setTimeout(() => {
    b.textContent = before;
    b.classList.remove('done');
  }, 1600);
}

export function bindCopy() {
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-copy]:not([data-bound]), [data-copy-from]:not([data-bound])')) {
    b.dataset.bound = '';
    b.addEventListener('click', async () => {
      const text = b.dataset.copyFrom ? (document.getElementById(b.dataset.copyFrom)?.textContent ?? '') : b.dataset.copy!;
      try {
        await navigator.clipboard.writeText(text);
        flash(b, 'Copied');
      } catch {
        flash(b, 'Copy failed');
      }
    });
  }
}
