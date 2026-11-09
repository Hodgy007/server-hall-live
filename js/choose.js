// A small in-page choice dialog: choose(title, body, [{ id, label, primary }], notes) → the id picked, or null for Esc
// or Cancel. Needs a <dialog id="choice"> with #choiceTitle, #choiceBody, #choiceList and #choiceBtns in the page.
export function choose(title, body, options, notes = [], cancelLabel = 'Cancel') {
  const d = document.getElementById('choice');
  document.getElementById('choiceTitle').textContent = title;
  document.getElementById('choiceBody').textContent = body;
  const ul = document.getElementById('choiceList'); ul.textContent = ''; ul.hidden = !notes.length;
  for (const n of notes.slice(0, 12)) { const li = document.createElement('li'); li.textContent = n; ul.append(li); }
  if (notes.length > 12) { const li = document.createElement('li'); li.textContent = `…and ${notes.length - 12} more`; ul.append(li); }
  const box = document.getElementById('choiceBtns'); box.textContent = '';
  return new Promise(ok => {
    let picked = null;
    for (const o of [...options, { id: null, label: cancelLabel }]) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = o.label; if (o.primary) b.className = 'primary';
      b.addEventListener('click', () => { picked = o.id; d.close(); });
      box.append(b);
    }
    d.addEventListener('close', () => ok(picked), { once: true });
    d.showModal();
    box.querySelector('button').focus();
  });
}
