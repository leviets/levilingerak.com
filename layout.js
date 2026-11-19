// Designed project pages (Projects/<folder>/layout.json).
// Used by the site (index.html) AND by the Site Editor, so both draw a page the same way.
//
// layout.json:
// { "version": 1,
//   "bands": [
//     { "type": "split", "rows": 8, "left": [block, ...], "right": [block, ...] },
//     { "type": "full",  "rows": 10, "blocks": [block, ...] } ] }
// block: { "kind": "title" | "short" | "story" | "text" | "picture" | "facts",
//          "col": 1, "row": 1, "w": 6, "h": 4,          (cells: 6 columns in a half, 12 in a full band)
//          "size": "s" | "m" | "l" | "xl",              (titles and texts)
//          "text": "...",                               (free titles and texts)
//          "photo": "chair1.jpg", "ratio": 0.75 }        (pictures: which photo, and its proportion)
// The project name is not a block: it always stands at the top of the page, above the bands.
// "short" and "story" show the project's own short description and story (project.txt).
window.PageLayout = (() => {
    const TITLE_KINDS = ['name', 'title'];
    const TEXT_KINDS = ['short', 'story', 'text'];

    // How many rows a band's halves have: at least its own "rows", and enough for every block.
    function rowsOf(band) {
        const blocks = band.type === 'full' ? band.blocks : [...band.left, ...band.right];
        return Math.max(band.rows || 1, ...blocks.map(b => b.row + b.h - 1));
    }

    // ctx: { name, short, story, facts: [[label, value]], photoUrl(file), caption(file) }
    function blockElement(block, ctx) {
        if (block.kind === 'name') return null;      // (older designs) the name is always at the top now
        const el = document.createElement('div');
        el.className = `lp-block lp-${block.kind}`;
        el.style.gridColumn = `${block.col} / span ${block.w}`;
        el.style.gridRow = `${block.row} / span ${block.h}`;
        if (TITLE_KINDS.includes(block.kind)) {
            el.classList.add('lp-size-' + (block.size || 'l'));
            const h = document.createElement('h2');
            h.textContent = block.kind === 'name' ? ctx.name : (block.text || '');
            el.append(h);
        } else if (TEXT_KINDS.includes(block.kind)) {
            el.classList.add('lp-size-' + (block.size || 'm'));
            const body = document.createElement('div');
            body.className = 'lp-text-body';
            const text = block.kind === 'short' ? ctx.short : block.kind === 'story' ? ctx.story : (block.text || '');
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
                img.style.objectPosition = block.pos || '50% 50%';
                el.append(img);
            } else {
                el.classList.add('is-empty');
            }
        } else if (block.kind === 'facts') {
            const dl = document.createElement('dl');
            (ctx.facts || []).forEach(([label, value]) => {
                const dt = document.createElement('dt');
                dt.textContent = label;
                const dd = document.createElement('dd');
                if (label === 'Link' && /^https?:\/\//i.test(value)) {
                    const a = document.createElement('a');
                    a.href = value;
                    a.target = '_blank';
                    a.rel = 'noopener';
                    a.textContent = value.replace(/^https?:\/\/(www\.)?/i, '') + ' ↗';
                    dd.append(a);
                } else {
                    dd.textContent = value;
                }
                dl.append(dt, dd);
            });
            el.append(dl);
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

    return { render, rowsOf, TITLE_KINDS, TEXT_KINDS };
})();

// The top of a project page: line up the top of the facts' first word ("CATEGORY") with the top of the
// title's capital letter. Works out where the letters' ink starts from the fonts' own measurements.
window.PageLayout.alignFacts = (title, facts) => {
    facts.style.marginTop = '';
    const first = facts.querySelector('dt');
    if (!title.textContent || !first) return;
    const t = title.getBoundingClientRect(), f = facts.getBoundingClientRect();
    if (f.left < t.right - 4 && f.top > t.top) return;          // stacked (phone): nothing to line up
    const canvas = window.PageLayout._canvas || (window.PageLayout._canvas = document.createElement('canvas'));
    const g = canvas.getContext('2d');
    // From the top of an element's first line to the top of its capital letters.
    const capTop = (el, letter) => {
        const cs = getComputedStyle(el);
        g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const m = g.measureText(letter);
        const size = parseFloat(cs.fontSize);
        const lineHeight = cs.lineHeight === 'normal' ? size * 1.2 : parseFloat(cs.lineHeight);
        const ascent = m.fontBoundingBoxAscent, descent = m.fontBoundingBoxDescent;
        return parseFloat(cs.paddingTop) + (lineHeight - (ascent + descent)) / 2 + ascent - m.actualBoundingBoxAscent;
    };
    const titleCap = t.top + capTop(title, title.textContent.trim()[0]);
    const factsCap = f.top + (first.getBoundingClientRect().top - f.top) + capTop(first, (first.textContent.trim()[0] || 'C').toUpperCase());
    facts.style.marginTop = Math.max(0, titleCap - factsCap).toFixed(1) + 'px';
};
