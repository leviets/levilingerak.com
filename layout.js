// Designed project pages (Projects/<folder>/layout.json).
// Used by the site (script.js) AND by the Site Editor, so both draw a page the same way.
//
// layout.json:
// { "version": 1,
//   "bands": [
//     { "type": "split", "rows": 12, "left": [block, ...], "right": [block, ...] },
//     { "type": "full",  "rows": 8,  "blocks": [block, ...] } ] }
// block: { "kind": "title" | "story" | "text" | "picture",
//          "col": 1, "row": 1, "w": 6, "h": 4,          (cells: 6 columns in a half, 12 in a full band)
//          "size": "s" | "m" | "l" | "xl",              (titles and texts)
//          "text": "...",                               (free titles and texts)
//          "photo": "chair1.jpg", "ratio": 0.75 }        (pictures: which photo, and its proportion)
// "story" shows the project's own story (project.txt). The title, short description and facts are not
// blocks: they always stand at the top of the page, above the bands.
window.PageLayout = (() => {
    const TITLE_KINDS = ['title'];
    const TEXT_KINDS = ['story', 'text'];

    // How many rows a band's halves have: at least its own "rows", and enough for every block.
    function rowsOf(band) {
        const blocks = band.type === 'full' ? band.blocks : [...band.left, ...band.right];
        return Math.max(band.rows || 1, ...blocks.map(b => b.row + b.h - 1));
    }

    // ctx: { name, story, photoUrl(photo), caption(photo) }
    function blockElement(block, ctx) {
        const el = document.createElement('div');
        el.className = `lp-block lp-${block.kind}`;
        el.style.gridColumn = `${block.col} / span ${block.w}`;
        el.style.gridRow = `${block.row} / span ${block.h}`;
        if (TITLE_KINDS.includes(block.kind)) {
            el.classList.add('lp-size-' + (block.size || 'l'));
            const h = document.createElement('h2');
            h.textContent = block.text || '';
            el.append(h);
        } else if (TEXT_KINDS.includes(block.kind)) {
            el.classList.add('lp-size-' + (block.size || 'm'));
            const body = document.createElement('div');
            body.className = 'lp-text-body';
            const text = block.kind === 'story' ? ctx.story : (block.text || '');
            text.split(/\n{2,}/).filter(Boolean).forEach(part => {
                const p = document.createElement('p');
                p.textContent = part;
                body.append(p);
            });
            el.append(body);
        } else if (block.kind === 'picture') {
            if (block.ratio) el.style.setProperty('--ratio', String(block.ratio));   // its exact proportion
            const url = block.photo ? ctx.photoUrl(block.photo) : '';
            if (url) {
                const img = document.createElement('img');
                img.src = url;
                img.alt = (ctx.caption && ctx.caption(block.photo)) || ctx.name;
                img.loading = 'lazy';
                img.decoding = 'async';
                el.append(img);
            } else {
                el.classList.add('is-empty');
            }
        } else {
            return null;      // (older kinds: the name, short description and facts are at the top now)
        }
        return el;
    }

    function render(container, layout, ctx) {
        container.innerHTML = '';
        container.classList.add('lp-page');
        (layout.bands || []).forEach((band, bandIndex) => {
            const bandEl = document.createElement('div');
            bandEl.className = 'lp-band lp-' + band.type;
            bandEl.dataset.band = bandIndex;
            const halves = band.type === 'full' ? [['full', band.blocks]] : [['left', band.left], ['right', band.right]];
            halves.forEach(([side, blocks]) => {
                const half = document.createElement('div');
                half.className = 'lp-half lp-side-' + side;
                const grid = document.createElement('div');
                grid.className = 'lp-grid';
                grid.dataset.band = bandIndex;
                grid.dataset.side = side;
                // Each half only as many rows as it uses (so on a phone a short half leaves no gap below it);
                // "rows" of the band adds empty rows on purpose.
                const rows = Math.max(band.rows || 1, ...blocks.map(b => b.row + b.h - 1));
                grid.style.gridTemplateRows = `repeat(${rows}, minmax(var(--lp-row), auto))`;
                blocks.forEach((block, i) => {
                    const el = blockElement(block, ctx);
                    if (!el) return;
                    el.dataset.band = bandIndex;
                    el.dataset.side = side;
                    el.dataset.index = i;
                    grid.append(el);
                });
                half.append(grid);
                bandEl.append(half);
            });
            container.append(bandEl);
        });
    }

    // The top of a project page: line up the top of the facts' first word ("CATEGORY") with the top of
    // the title's capital letter, worked out from the fonts' own measurements.
    let measure = null;
    // From the top of an element's first line to the top of its capital letters.
    function capTop(el, letter) {
        measure = measure || document.createElement('canvas').getContext('2d');
        const cs = getComputedStyle(el);
        measure.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const m = measure.measureText(letter);
        const size = parseFloat(cs.fontSize);
        const lineHeight = cs.lineHeight === 'normal' ? size * 1.2 : parseFloat(cs.lineHeight);
        const ascent = m.fontBoundingBoxAscent, descent = m.fontBoundingBoxDescent;
        return parseFloat(cs.paddingTop) + (lineHeight - (ascent + descent)) / 2 + ascent - m.actualBoundingBoxAscent;
    }
    // The picture at the top of a project page: the top of the title's capital lines up with the picture's top.
    function alignPicture(title, picture) {
        const text = title.parentElement;
        text.style.marginTop = '';
        if (!picture || picture.hidden || !title.textContent) return;
        const p = picture.getBoundingClientRect(), t = title.getBoundingClientRect();
        if (t.right > p.left + 4 && t.left < p.right - 4) return;  // stacked (phone): nothing to line up
        const cap = t.top + capTop(title, title.textContent.trim()[0]);
        text.style.marginTop = (p.top - cap + 6).toFixed(1) + 'px';    // (+6: a touch lower looks right)
    }
    function alignFacts(title, facts) {
        facts.style.marginTop = '';
        const first = facts.querySelector('dt');
        if (!title.textContent || !first) return;
        const t = title.getBoundingClientRect(), f = facts.getBoundingClientRect();
        if (f.left < t.right - 4 && f.top > t.top) return;          // stacked (phone): nothing to line up
        const titleCap = t.top + capTop(title, title.textContent.trim()[0]);
        const factsCap = first.getBoundingClientRect().top + capTop(first, (first.textContent.trim()[0] || 'C').toUpperCase());
        facts.style.marginTop = Math.max(0, titleCap - factsCap).toFixed(1) + 'px';
    }

    return { render, rowsOf, alignFacts, alignPicture, TITLE_KINDS, TEXT_KINDS };
})();
