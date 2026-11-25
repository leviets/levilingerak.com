// ================================================================
// levilingerak.com — everything the pages do.
// Projects are listed in Projects/projects.json. Each project's text comes from
// Projects/<folder>/project.txt, its pictures from Projects/<folder>/Pictures/, and an own page
// design (made in the Site Editor) from Projects/<folder>/layout.json.
// Contents: materials · routing · reading the files · cards · home timeline · Info page events ·
// the big name · project page · profile · background.
// ================================================================
const VIDEO_EXT = /\.(mp4|webm|mov)$/i;
const DEFAULT_TITLE = document.title;

// The materials in the menu, in this order. "color" is used for dots, lines and accents;
// "ink" is a darker shade of it that stays readable as text. "words" are other spellings
// accepted in project.txt.
const CATEGORIES = [
    { id: 'wood',      name: 'Wood',      color: '#8a5530', ink: '#7a4626', words: ['woodwork', 'woodworking', 'hout'] },
    { id: 'plastic',   name: 'Plastic',   color: '#e0b02a', ink: '#946f00', words: ['plastics', 'kunststof'] },
    { id: 'metal',     name: 'Metal',     color: '#7c8288', ink: '#5d6268', words: ['metals', 'metalwork', 'metaal'] },
    { id: 'stone',     name: 'Stone',     color: '#5c8a52', ink: '#46713d', words: ['stoneware', 'ceramics', 'ceramic', 'clay', 'keramiek', 'steen'] },
    { id: 'textile',   name: 'Textile',   color: '#2f5d93', ink: '#2a5285', words: ['textiles', 'fabric', 'denim', 'textiel'] },
    { id: 'other',     name: 'Other',     color: '#c0392b', ink: '#a8301f', words: ['others', 'overig', 'anders'] }
];
const categoryById = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
const PAGES = ['home', 'shop', 'info', 'contact', ...CATEGORIES.map(c => c.id)];

// "Textile, Wood" -> ['textile', 'wood']. Old names (Woodwork, Stoneware, Plastics) still work. Anything unknown counts as Other.
function parseCategories(value) {
    const ids = [];
    (value || '').split(/[,;\/&+]|\band\b|\ben\b/i).forEach(part => {
        const word = part.trim().toLowerCase();
        if (!word) return;
        const match = CATEGORIES.find(c => c.id === word || c.name.toLowerCase() === word || c.words.includes(word));
        const id = match ? match.id : 'other';
        if (!ids.includes(id)) ids.push(id);
    });
    return ids.length ? ids : ['other'];
}

const EVENT_COLOR = { color: '#1f1813', ink: '#1f1813' };   // events: plain black
function setColor(el, categoryId) {
    const category = categoryId === 'event' ? EVENT_COLOR : categoryById[categoryId] || categoryById.other;
    el.style.setProperty('--project-color', category.color);
    el.style.setProperty('--project-ink', category.ink);
}

// Menu: one link per material, each in its own colour.
const categoryNav = document.getElementById('category-nav');
CATEGORIES.forEach(category => {
    const link = document.createElement('a');
    link.className = 'category-link';
    link.href = '#' + category.id;
    link.dataset.page = category.id;
    link.textContent = category.name;
    setColor(link, category.id);
    categoryNav.append(link);
});

const navLinks = document.querySelectorAll('.nav-link, .category-link');
const pages = document.querySelectorAll('[data-page-section]');
let projects = [];
let projectsLoaded = false;

// ---- Routing (#home, #info, #wood, #textile, ..., #project/<folder>) ----
function route() {
    const hash = decodeURIComponent(window.location.hash.replace('#', ''));
    let pageName = PAGES.includes(hash) ? hash : 'home';
    let navName = pageName;
    document.title = DEFAULT_TITLE;

    if (categoryById[pageName]) {
        renderCategory(pageName);
        pageName = 'category';
    }

    if (hash.startsWith('project/')) {
        if (!projectsLoaded) return; // route() runs again once projects are loaded
        const project = projects.find(p => p.folder === hash.slice(8));
        if (project && project.hasPage) {
            renderDetail(project);
            pageName = 'project';
            navName = project.isEvent ? 'home' : project.categories[0];
        }
    }

    if (pageName !== 'project') showFilm(null);      // a film stops playing when you leave its page
    pages.forEach(page => page.classList.toggle('active', page.dataset.pageSection === pageName));
    navLinks.forEach(link => {
        const isActive = link.dataset.page === navName;
        link.classList.toggle('active', isActive);
        if (isActive) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => arrangeBlobs(categoryById[pageName === 'category' ? hash : ''] ? hash : null));   // the background follows
}

function go(pageName) {
    if (window.location.hash === '#' + pageName) route();
    else window.location.hash = pageName;
}

document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', () => go(link.dataset.page)));
window.addEventListener('hashchange', route);

// ---- Category page: every project that lists this material ----
function renderCategory(id) {
    const category = categoryById[id];
    const section = document.getElementById('category');
    setColor(section, id);
    document.getElementById('category-title').textContent = category.name;
    const desc = document.getElementById('category-desc');        // the material's own text, beside its name
    desc.textContent = category.description || '';
    desc.hidden = !category.description;
    document.title = `${category.name} — Levi Lingerak`;

    let visible = 0;
    document.querySelectorAll('#project-grid .project').forEach(card => {
        // (Work in progress stays on the home page only.)
        const show = card.dataset.categories.split(' ').includes(id) && !card.project.wip;
        card.classList.toggle('hidden', !show);
        if (!show) return;
        // On a material page every project takes that material's colour.
        setColor(card, id);
        // Up to 3 items ("3D printed hinges, zip, tubes"), one under the other.
        card.querySelector('.project-part').textContent = (card.project.parts[id] || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 3).join('\n');
        visible++;
    });
    layoutWall();
    document.getElementById('category-empty').hidden = visible > 0 || !projectsLoaded;
    requestAnimationFrame(fitDescLine);
}

// The coloured line beside the material's text: exactly as tall as the letters of the big name next to it
// (from the top of its letters down to the line they stand on); the text is centred on those letters.
const descMeasure = document.createElement('canvas').getContext('2d');
function fitDescLine() {
    const title = document.getElementById('category-title'), desc = document.getElementById('category-desc');
    if (!title || !desc || desc.hidden || !desc.offsetWidth || !title.textContent) return;
    desc.style.translate = '';
    const mark = document.createElement('span');                 // (sits on the name's baseline)
    mark.style.cssText = 'display:inline-block;width:0;height:0';
    title.append(mark);
    const baseline = mark.getBoundingClientRect().bottom;
    mark.remove();
    const cs = getComputedStyle(title);
    descMeasure.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const top = baseline - descMeasure.measureText(title.textContent).actualBoundingBoxAscent;
    const r = desc.getBoundingClientRect();
    // The text is centred on the name's letters (whatever its length); the line, as tall as the letters, on the text.
    if (r.right < title.getBoundingClientRect().left) desc.style.translate = `0 ${((top + baseline) / 2 - (r.top + r.bottom) / 2).toFixed(1)}px`;
    const room = (r.height - (baseline - top)) / 2;              // centred on the text
    desc.style.setProperty('--line-top', room.toFixed(1) + 'px');
    desc.style.setProperty('--line-bottom', room.toFixed(1) + 'px');
}
window.addEventListener('resize', () => requestAnimationFrame(fitDescLine));
if (document.fonts) document.fonts.ready.then(fitDescLine);

// Material pages as a photo wall: every picture in a row the same height, each in its own
// proportion, the rows filling the page width. (On a phone: one picture per row.)
function layoutWall() {
    const grid = document.getElementById('project-grid');
    const width = grid.clientWidth;
    if (!width) return;                          // not on screen yet: the ResizeObserver comes back
    const cards = [...grid.querySelectorAll('.project:not(.hidden)')];
    const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
    const ratioOf = card => parseFloat(card.querySelector('.project-image').style.aspectRatio) || 4 / 3;
    if (width < 600) { cards.forEach(card => { card.style.width = '100%'; }); return; }
    const target = Math.max(300, width * 0.28);  // the height a row aims for (about the size of Oso)
    // Height of a row of these cards when it fills the width exactly.
    const fit = list => {
        const ratios = list.reduce((sum, c) => sum + ratioOf(c), 0);
        const room = width - (list.length - 1) * gap - 1;   // (1px spare against rounding)
        return Math.floor(room / ratios * 100) / 100;
    };
    const place = (list, height) => list.forEach(card => { card.style.width = (ratioOf(card) * height) + 'px'; });
    let row = [];
    cards.forEach(card => {
        const without = row.length ? fit(row) : Infinity;
        const withIt = fit([...row, card]);
        if (withIt > target) { row.push(card); return; }   // still room
        // Full: take this picture in only if the row doesn't get smaller than the minimum; otherwise it
        // starts the next row (and this row grows a bit taller to fill the width).
        // (A little smaller is allowed when the row would otherwise become very tall.)
        const smallest = without > target * 1.4 ? target * 0.84 : target * 0.9;
        if (row.length && withIt < smallest) {
            place(row, without);
            row = [card];
        } else {
            place([...row, card], withIt);
            row = [];
        }
    });
    if (row.length) place(row, Math.min(target, fit(row)));   // the last row keeps the normal height
}
new ResizeObserver(layoutWall).observe(document.getElementById('project-grid'));

// Picture texts ("Picture x.jpg: ..." in project.txt) are always the pictures' descriptions for
// search engines and screen readers. Set this to true to also show them under the pictures.
const SHOW_PICTURE_TEXTS = false;

// ---- Reading project.txt / profile.txt ----
const PROJECT_KEYS = ['project name', 'what it is', 'categories', 'category', 'date', 'year', 'short description', 'story title', 'detailed description',
    'materials', 'techniques', 'dimensions', 'location', 'made for', 'supervised by', 'duration', 'exhibited',
    'for sale', 'collaborators', 'photography', 'link', 'size', 'learnt',
    ...CATEGORIES.map(c => c.id + ' part')];      // e.g. "Plastic part: the 3D-printed handle"
const PROFILE_KEYS = ['name', 'tagline', 'location', 'short introduction', 'biography', 'email', 'info label', 'info title',
    'contact label', 'contact title', 'contact intro',
    'instagram', 'education', 'available for'];

// "Key: value" lines for known keys. Lines starting with # are notes.
// Other lines continue the previous field; an empty line between them starts a new paragraph.
function parseInfoFile(text, keys) {
    const data = {};
    let current = null;
    let paragraphBreak = false;
    text.split(/\r?\n/).forEach(raw => {
        const line = raw.trim();
        if (line.startsWith('#')) return;
        if (!line) { paragraphBreak = true; return; }
        const pic = line.match(/^picture\s+([^\s:]+\.[a-z0-9]+)\s*:\s*(.*)$/i);   // "Picture chair1.jpg: text"
        const m = line.match(/^([A-Za-z ]+?)\s*:\s*(.*)$/) || line.match(/^(size)\s+(.*)$/i);
        if (pic && keys === PROJECT_KEYS) {
            current = 'picture ' + pic[1].toLowerCase();
            data[current] = pic[2].trim();
        } else if (m && keys.includes(m[1].trim().toLowerCase())) {
            current = m[1].trim().toLowerCase();
            data[current] = m[2].trim();
        } else if (current) {
            // A blank line starts a new paragraph. In the profile (written by the editor) a single line break is
            // kept too (an Enter you typed); in project files the lines are simply joined.
            const sep = !data[current] ? '' : paragraphBreak ? '\n\n' : keys === PROFILE_KEYS ? '\n' : ' ';
            data[current] += sep + line;
        }
        paragraphBreak = false;
    });
    return data;
}

// The home introduction: its opening a little apart from the rest. The opening is everything up to the first
// empty line you typed; without one, the first line; without line breaks, the first sentence.
function introParts(text) {
    const m = text.match(/^([\s\S]*?)\n\s*\n([\s\S]*)$/) || text.match(/^([^\n]*)\n([\s\S]*)$/)
        || text.match(/^([^\n]*?[.!?])\s+([\s\S]*)$/);
    if (!m) return [text];
    const lead = document.createElement('span');
    lead.className = 'intro-lead';
    lead.textContent = m[1].trim();
    return [lead, m[2]];
}

function toParagraphs(text) {
    return text.split(/\n{2,}/).map(part => {
        const p = document.createElement('p');
        p.textContent = part;
        return p;
    });
}

// Accepts DD-MM-YYYY, YYYY-MM-DD (also with / or .), or just a year.
function parseDate(value) {
    if (!value) return null;
    let m = value.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
    if (m) return new Date(+m[1], m[2] - 1, +m[3]).getTime();
    m = value.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
    if (m) return new Date(+m[3], m[2] - 1, +m[1]).getTime();
    m = value.match(/^(\d{4})$/);
    if (m) return new Date(+m[1], 0, 1).getTime();
    return null;
}

// "12-12-2023" -> "12 Dec 2023"; a year alone stays a year.
function formatDate(raw, time) {
    if (!raw) return '';
    if (time === null || /^\d{4}$/.test(raw.trim())) return raw.trim();
    return new Date(time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Size 20-100 (%), as typed in project.txt.
function parseSize(value) {
    const n = parseFloat(value);
    return isNaN(n) ? 50 : Math.min(100, Math.max(20, n));
}

// Folder "paro_tee" becomes the name "Paro tee" when project.txt has no name.
function folderToName(folder) {
    const name = folder.replace(/_+/g, ' ');
    return name.charAt(0).toUpperCase() + name.slice(1);
}

function mediaUrl(folder, file) {
    return encodeURI(`Projects/${folder}/Pictures/${file}`);
}

// Same "random" numbers for a project every visit, so the layout doesn't jump around.
function seededRandom(seed) {
    let h = 2166136261;
    for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return () => {
        h = Math.imul(h ^ (h >>> 15), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
}

async function loadProject(entry, index) {
    let data = {};
    try {
        const response = await fetch(encodeURI(`Projects/${entry.folder}/project.txt`), { cache: 'no-cache' });
        if (response.ok) data = parseInfoFile(await response.text(), PROJECT_KEYS);
    } catch (e) { /* no project.txt: use defaults */ }

    const media = (entry.media || []).map(file => ({
        url: mediaUrl(entry.folder, file),
        isVideo: VIDEO_EXT.test(file),
        caption: data['picture ' + file.toLowerCase()] || ''
    }));
    const cover = media.find(m => !m.isVideo);
    const rawDate = data['date'] || data['year'] || '';
    const date = parseDate(rawDate);
    // Events ("type": "event" in projects.json, e.g. Dutch Design Week visits) stand on the
    // timeline but have no material: they are not on the material pages and stay black.
    const isEvent = entry.type === 'event';
    const categories = isEvent ? [] : parseCategories(data['categories'] || data['category']);
    const categoryNames = isEvent ? 'Event' : categories.map(id => categoryById[id].name).join(', ');

    return {
        index,
        folder: entry.folder,
        isEvent,
        name: data['project name'] || folderToName(entry.folder),
        categories,          // the first one sets the project's colour
        categoryNames,
        dateText: formatDate(rawDate, date),
        date,
        kind: (data['what it is'] || '').trim(),   // what it is, e.g. "Chair" or "Video"
        // What each material is used for ("Plastic part: ..."), shown on the material pages and in the facts.
        parts: Object.fromEntries(categories.map(id => [id, (data[id + ' part'] || '').trim()])),
        short: data['short description'] || '',
        storyTitle: (data['story title'] || '').trim(),   // a title above the story (optional)
        detail: data['detailed description'] || '',
        // Every fact is always listed, in the same order; one that isn't filled in shows a stripe.
        // (Events only have the facts that fit an event. A link is only shown when there is one.)
        facts: [
            [isEvent ? 'Type' : categories.length > 1 ? 'Categories' : 'Category', categoryNames],
            ['Date', formatDate(rawDate, date)],
            ...(isEvent ? [] : [
                ['Materials', data['materials']],
                ...categories.map(id => [categoryById[id].name + ' part', data[id + ' part']]),
                ['Techniques', data['techniques']],
                ['Dimensions', data['dimensions']]]),
            ['Location', data['location']],
            ...(isEvent ? [] : [
                ['Made for', data['made for']],
                ['Collaborators', data['collaborators']],
                ['Supervised by', data['supervised by']],
                ['Duration', data['duration']],
                ['Learnt', data['learnt']]]),
            ['Exhibited', data['exhibited']],
            ...(isEvent ? [] : [['For sale', data['for sale']]]),
            ['Photography', data['photography']],
            ['Link', data['link']]
        ].map(([label, value]) => [label, (value || '').trim() || (label === 'Link' ? '' : '—')])
         .filter(([, value]) => value),
        size: parseSize(data['size']),
        frame: parseFrame(entry.frame),   // proportion of the cover's frame, e.g. 16 / 9
        // "page": false -> no project page; "wip": true -> work in progress: shown blurred, not clickable.
        wip: entry.wip === true,
        hasPage: entry.page !== false && entry.wip !== true,
        // A film: "youtube" (the video's id) plays at the top of the project page; "hover" is a few silent
        // seconds of it that play over the thumbnail on hover (both written by the Site Editor).
        youtube: entry.youtube || '',
        hoverClip: entry.hover ? mediaUrl(entry.folder, entry.hover) : null,
        // A picture project: optional pictures ("swap": one file name or a list) shown one after another on hover.
        swap: entry.swap && !entry.hover ? [].concat(entry.swap).slice(0, 10).map(file => mediaUrl(entry.folder, file)) : null,   // (10 at most)
        // "reverse": the hover goes back and forth (photos 1-2-3-2-1; a clip has it built in by the Site Editor).
        reverse: !!entry.reverse,
        cover: cover ? cover.url : null,
        // The pictures at the top of the project page, right of the title: "top" in projects.json, one wide
        // picture or two upright ones side by side (chosen in the Site Editor). Without it: no picture there.
        top: [].concat(entry.top || []).filter(file => (entry.media || []).includes(file)).slice(0, 2),
        mediaFiles: entry.media || [],    // file names, for a designed page (layout.json)
        media
    };
}

// ---- Frame proportions on the home page: square, 4:3, 3:4, 16:9 or 9:16 ----
// "frame" in projects.json (written by the Site Editor). Without it, the cover picture's own
// shape is used, rounded to the nearest of these.
const FRAMES = [1, 4 / 3, 3 / 4, 16 / 9, 9 / 16];
function nearestFrame(ratio) {
    return FRAMES.reduce((best, f) => Math.abs(Math.log(f / ratio)) < Math.abs(Math.log(best / ratio)) ? f : best, 1);
}
function parseFrame(value) {
    const m = String(value || '').match(/^\s*(\d+(?:\.\d+)?)\s*[:x\/]\s*(\d+(?:\.\d+)?)\s*$/i);
    if (/^\s*square\s*$/i.test(value || '')) return 1;
    return m && +m[2] ? nearestFrame(+m[1] / +m[2]) : null;
}

// ---- Rendering ----
function createCard(project, className) {
    // Projects without a page of their own ("page": false in projects.json) can't be clicked.
    const card = document.createElement(project.hasPage ? 'a' : 'div');
    card.className = className + (project.hasPage ? '' : ' no-page') + (project.wip ? ' is-wip' : '');
    if (project.hasPage) card.href = '#project/' + encodeURIComponent(project.folder);
    card.dataset.categories = project.categories.join(' ');
    setColor(card, project.isEvent ? 'event' : project.categories[0]);

    const imageBox = document.createElement('div');
    imageBox.className = 'project-image';
    if (project.cover) {
        const img = document.createElement('img');
        img.src = project.cover;
        img.alt = project.name;
        img.loading = 'lazy';
        img.decoding = 'async';
        imageBox.append(img);
    } else {
        imageBox.classList.add('is-empty');
    }
    if (project.wip) {                           // work in progress: "Coming soon" over the blurred picture
        const soon = document.createElement('span');
        soon.className = 'coming-soon';
        soon.textContent = 'Coming soon';
        if (project.cover) soon.style.backgroundImage = `linear-gradient(rgba(31, 24, 19, 0.45), rgba(31, 24, 19, 0.45)), url("${project.cover}")`;   // the sharp picture, seen through the letters
        imageBox.append(soon);
    }

    // Name on the left, date on the right.
    const meta = document.createElement('div');
    meta.className = 'project-meta';
    const title = document.createElement('h3');
    title.textContent = project.name;
    const date = document.createElement('span');
    date.textContent = project.dateText;
    meta.append(title, date);
    const kind = document.createElement('p');      // what it is, under the name
    kind.className = 'project-kind';
    kind.textContent = project.kind;
    if (className === 'project') {
        // Material pages: across from the name, in that material's colour, what the material is used
        // for in this project (e.g. "3D printed hinges" on the Plastic page). Filled in by renderCategory.
        // (beside the name when it fits, otherwise on the line under it)
        const part = document.createElement('p');
        part.className = 'project-part';
        // The name with "what it is" right under it (always the same distance), the part text beside them.
        const nameBlock = document.createElement('div');
        nameBlock.className = 'project-name-block';
        nameBlock.append(title, kind);
        const row = document.createElement('div');
        row.className = 'project-title-row';
        row.append(nameBlock, part);
        meta.prepend(row);
        card.project = project;
    } else if (project.kind) {
        meta.append(kind);
    }

    card.append(imageBox, meta);
    const img = imageBox.querySelector('img');
    if (img) {
        const withClip = project.hoverClip && project.hasPage && !reduceMotion;
        const withSwap = !withClip && project.swap && project.swap.length && !project.wip;
        // A hover clip or hover pictures lie in one box with the cover, and that box gets the soft edges: one mask,
        // one hover animation, so the clip can never drift a pixel from the picture (that made the square twitch).
        let media = null;
        if (withClip || withSwap) {
            media = document.createElement('div');
            media.className = 'project-media';
            img.replaceWith(media);
            media.append(img);
        }
        if (withClip) hoverClip(card, media, project.hoverClip);
        else if (withSwap) hoverPictures(card, media, project.swap, project.reverse);
        // Soft edges on the home, material and Info pages (not on the project pages themselves).
        softEdges(img, media || img);
        // The frame has the picture's own proportion (square, 4:3, 3:4, 16:9 or 9:16).
        if (project.frame) imageBox.style.aspectRatio = String(project.frame);
        else {
            const measure = () => {
                if (!img.naturalWidth) return;
                imageBox.style.aspectRatio = String(nearestFrame(img.naturalWidth / img.naturalHeight));
                if (className === 'project') layoutWall();
            };
            if (img.complete) measure(); else img.addEventListener('load', measure, { once: true });
        }
    }
    return card;
}

// A film project: its few silent seconds play over the thumbnail while the mouse is on it.
// Nothing is downloaded until the first hover.
const HOVER_ANIMATION_MS = 500;       // the clip starts this long after the mouse comes on (the edges grow in 1400ms, style.css)
function hoverClip(card, imageBox, url) {
    const clip = document.createElement('video');
    clip.className = 'hover-clip';
    clip.muted = true;
    clip.loop = true;
    clip.playsInline = true;
    clip.preload = 'none';
    clip.setAttribute('aria-hidden', 'true');
    clip.src = url;
    imageBox.append(clip);
    card.classList.add('has-hover-clip');        // (style.css: one layer, so nothing twitches)
    // Loaded in full once the card comes near the screen, so it doesn't stutter while it starts.
    const near = new IntersectionObserver(entries => {
        if (!entries.some(e => e.isIntersecting)) return;
        near.disconnect();
        clip.preload = 'auto';
        clip.load();
    }, { rootMargin: '300px' });
    near.observe(card);
    let rest = 0, wait = 0, hovering = false;
    // Fade in only once a moving frame is really on screen (not while the first frames are still decoding).
    const show = () => { if (hovering) imageBox.classList.add('is-playing'); };
    card.addEventListener('mouseenter', () => {
        hovering = true;
        clearTimeout(rest);
        clearTimeout(wait);
        // The clip starts once the hover animation (the zoom and the edges growing, style.css) has finished.
        wait = setTimeout(() => {
            if (!hovering) return;
            clip.play().then(() => {
                if (clip.requestVideoFrameCallback) clip.requestVideoFrameCallback(() => clip.requestVideoFrameCallback(show));
                else show();
            }).catch(() => {});
        }, HOVER_ANIMATION_MS);
    });
    card.addEventListener('mouseleave', () => {
        hovering = false;
        clearTimeout(wait);
        imageBox.classList.remove('is-playing');
        rest = setTimeout(() => { clip.pause(); clip.currentTime = 0; }, 400);   // after it has faded out
    });
    return clip;
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Soft edges: at rest a picture fades softly into the background, with round corners.
// On hover (or keyboard focus) the mask grows outward past the picture's edges (style.css),
// so the fade flows away: sharp and square, as if the picture comes forward. The mask is a
// blurred rounded rectangle drawn once at the picture's exact size, so the fade bends
// smoothly around the corners.
const FADE = 0.015;           // width of the soft edge, as part of the picture's width (the bare minimum)
function softMask(w, h) {
    const f = FADE * w;                          // soft edge in pixels
    const n = v => v.toFixed(2);
    const inset = f * 0.5, blur = f * 0.2, round = f * 0.9;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${n(w)}' height='${n(h)}'>` +
        `<filter id='s' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='${n(blur)}'/></filter>` +
        `<rect x='${n(inset)}' y='${n(inset)}' width='${n(w - 2 * inset)}' height='${n(h - 2 * inset)}' ` +
        `rx='${n(round)}' filter='url(%23s)'/></svg>`;
    return `url("data:image/svg+xml;utf8,${svg}")`;
}
// The hover pictures: they lie over the cover; while the mouse is on the card they fade in one after
// another, round and round, like a little slideshow (style.css: .hover-swap). Mouse off: the cover again.
const SLIDE_MS = 1400;        // each picture this long
const HOVER_DELAY = 500;      // the slideshow starts after the mouse has been on the card this long
const FADE_MS = 800;          // a picture's fade-in (style.css: .hover-swap)
function hoverPictures(card, imageBox, urls, backAndForth = false) {
    const slides = urls.map(url => {
        const pic = document.createElement('img');
        pic.className = 'hover-swap';
        pic.src = url;
        pic.alt = '';
        pic.loading = 'lazy';
        pic.decoding = 'async';
        imageBox.append(pic);
        return pic;
    });
    let wait = 0, timer = 0, at = -1, layer = 1, step = 0;
    // The order: 1, 2, 3, 1, 2, 3 … or back and forth: 1, 2, 3, 2, 1, 2, 3 …
    const order = slides.map((s, i) => i);
    if (backAndForth && slides.length > 2) order.push(...order.slice(1, -1).reverse());
    // The next picture fades in on top of the one before, which stays fully visible underneath until
    // the new one is there (so the cover never shines through in between).
    const show = i => {
        at = i;
        const pic = slides[i];
        const reveal = () => {
            if (slides[at] !== pic) return;                      // (moved on, or the mouse left, meanwhile)
            pic.style.zIndex = ++layer;
            pic.classList.add('is-shown');
            setTimeout(() => slides.forEach(other => { if (other !== slides[at]) other.classList.remove('is-shown'); }), FADE_MS);
        };
        // A picture that hasn't loaded yet waits (the one before stays visible meanwhile).
        if (pic.complete && pic.naturalWidth) reveal(); else pic.addEventListener('load', reveal, { once: true });
    };
    const start = () => {
        clearTimeout(wait);
        clearInterval(timer);
        wait = setTimeout(() => {
            step = 0;
            show(order[0]);
            if (slides.length > 1) timer = setInterval(() => { step = (step + 1) % order.length; show(order[step]); }, SLIDE_MS);
        }, HOVER_DELAY);
    };
    const stop = () => {
        clearTimeout(wait);
        clearInterval(timer);
        at = -1;
        slides.forEach(pic => pic.classList.remove('is-shown'));    // all fade out together: the cover again
    };
    card.addEventListener('mouseenter', start);
    card.addEventListener('mouseleave', stop);
    card.addEventListener('focusin', start);
    card.addEventListener('focusout', stop);
    return slides;
}

// The soft edges go on `target`: the picture itself, or the box holding it with its hover clip or pictures.
function softEdges(img, target) {
    let size = '';
    const paint = () => {
        const w = img.clientWidth, h = img.clientHeight;
        if (!w || !h || size === w + 'x' + h) return;
        size = w + 'x' + h;                      // only redrawn when the picture changes size
        const mask = softMask(w, h);
        target.style.webkitMaskImage = mask;
        target.style.maskImage = mask;
        target.style.setProperty('--fade-px', (FADE * w).toFixed(2) + 'px');   // used by style.css
    };
    new ResizeObserver(paint).observe(img);
}

// ---- Home: the timeline ----
const SVG_NS = 'http://www.w3.org/2000/svg';
let homeItems = [];

function renderHome() {
    const container = document.getElementById('home-projects');
    container.innerHTML = '';

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'home-path');
    svg.setAttribute('aria-hidden', 'true');
    container.append(svg);

    const startLabel = document.createElement('p');
    startLabel.className = 'path-label path-start';
    startLabel.textContent = 'Born · 2002';   // the line starts at birth
    container.append(startLabel);

    // Events (e.g. Dutch Design Week) are not on the home timeline: they have their own path on the Info page.
    homeItems = projects.filter(project => !project.isEvent).map(project => {
        const random = seededRandom(project.folder);
        const card = createCard(project, 'home-project');
        random(); random();   // (two numbers once used for tilt and sway; still drawn so every project keeps its place)
        container.append(card);
        const item = { card, size: project.size, swing: random(), spacing: random(), frame: project.frame || 1 };
        // No frame given: take the cover's shape once it has loaded, and lay out again.
        const img = card.querySelector('.project-image img');
        if (!project.frame && img) {
            const measure = () => {
                if (!img.naturalWidth) return;
                const frame = nearestFrame(img.naturalWidth / img.naturalHeight);
                if (frame !== item.frame) { item.frame = frame; scheduleHomeLayout(); }
            };
            if (img.complete) measure(); else img.addEventListener('load', measure, { once: true });
        }
        return item;
    });

    layoutHome();
}

// The path, as if drawn by hand: a calm, uneven wobble along the whole line and, between some
// pictures, a little loop. Always the same for the same projects (seeded randomness), and calm at
// both ends. Used on the home page and on the Info page (events).
function handDrawn(path, boxes, centre) {
    const random = seededRandom('hand-drawn line');
    const STEP = 5;
    // Measure the line once, every 2px; everything below reads from this table.
    // Calculated here from the path's own lines and curves (asking the browser is slow).
    const RES = 2;
    const flat = [];
    const nums = (path.getAttribute('d').match(/[MLC]|-?[\d.]+(?:e-?\d+)?/g) || []);
    let cmd = '', cur = { x: 0, y: 0 };
    for (let i = 0; i < nums.length;) {
        if (/[MLC]/.test(nums[i])) cmd = nums[i++];
        const n = k => parseFloat(nums[i + k]);
        if (cmd === 'C') {
            const [x1, y1, x2, y2, x, y] = [n(0), n(1), n(2), n(3), n(4), n(5)];
            for (let k = 1; k <= 32; k++) {
                const t = k / 32, u = 1 - t;
                flat.push({
                    x: u * u * u * cur.x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
                    y: u * u * u * cur.y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y
                });
            }
            cur = { x, y };
            i += 6;
        } else {
            cur = { x: n(0), y: n(1) };
            flat.push(cur);
            i += 2;
        }
    }
    const table = [flat[0]];
    let walked = 0, next = RES;
    for (let i = 1; i < flat.length; i++) {
        const a = flat[i - 1], b = flat[i], len = Math.hypot(b.x - a.x, b.y - a.y);
        while (len > 0 && walked + len >= next) {
            const t = (next - walked) / len;
            table.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
            next += RES;
        }
        walked += len;
    }
    const total = walked;
    table.push(flat[flat.length - 1]);
    const at = s => {
        const x = Math.max(0, Math.min(total, s)) / RES;
        const i = Math.min(table.length - 2, Math.floor(x)), t = Math.min(1, x - i);
        const a = table[i], b = table[i + 1] || a;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    };
    const tangentAt = s => {
        const a = at(s - 1.5), b = at(s + 1.5);
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    };

    // Wobble: a few slow waves across the path (it is a wide, soft band, so it may swing a lot),
    // faded out near both ends.
    const waves = [[9, 300], [5, 130], [2.5, 60]].map(([amp, length]) =>
        ({ amp, length: length * (0.8 + random() * 0.4), phase: random() * Math.PI * 2 }));
    const wobble = s => {
        const ends = Math.min(1, s / 40, (total - s) / 40);
        return ends * waves.reduce((sum, w) => sum + w.amp * Math.sin(s / w.length * Math.PI * 2 + w.phase), 0);
    };

    // Loops: halfway between some neighbouring pictures, where the line is in the open.
    const nearest = p => {
        let best = 0, bestDist = Infinity;
        table.forEach((q, i) => {
            const dd = Math.hypot(q.x - p.x, q.y - p.y);
            if (dd < bestDist) { bestDist = dd; best = i * RES; }
        });
        return best;
    };
    const inPicture = q => boxes.some(b => q.x > b.x - 12 && q.x < b.x + b.w + 12 && q.y > b.y - 12 && q.y < b.y + b.h + 12);
    const loops = [];
    const SIZE = 6;                         // loop size: a round loop of about 10px, the whole curl about 38px long
    const SPAN = 2 * Math.PI * SIZE;
    for (let i = boxes.length - 1; i > 0; i--) {
        if (random() > 0.3) continue;       // a loop in about 1 of every 3 gaps
        const s0 = (nearest(centre(boxes[i])) + nearest(centre(boxes[i - 1]))) / 2;
        const clear = [-SPAN, 0, SPAN].every(o => !inPicture(at(s0 + o)));
        if (clear && s0 > 60 && s0 < total - 60) loops.push({ s0, side: random() < 0.5 ? -1 : 1 });
    }

    // Walk along the line and collect the points of the new one.
    const points = [];
    const add = (s, extraAlong = 0, extraAcross = 0) => {
        const p = at(s + extraAlong), t = tangentAt(s + extraAlong);
        const across = wobble(s) + extraAcross;
        points.push({ x: p.x - t.y * across, y: p.y + t.x * across });
    };
    let s = 0;
    while (s <= total) {
        const loop = loops.find(l => s >= l.s0 - SPAN / 2 && s < l.s0 + SPAN / 2);
        if (loop) {
            // One clean round loop, like a pencil curling over itself: a prolate cycloid,
            // drawn straight along the line's direction at that spot (not bent along the curve).
            const p0 = at(loop.s0);
            const a = at(loop.s0 - SPAN / 2), b = at(loop.s0 + SPAN / 2);
            const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            const t = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
            // From -π to π: the line bends out, crosses itself, makes the round loop, and
            // comes back down to where it was going.
            for (let k = 1; k < 48; k++) {
                const th = -Math.PI + k / 48 * Math.PI * 2;
                const along = SIZE * (th - 2.2 * Math.sin(th));
                const across = wobble(loop.s0) + loop.side * SIZE * 2.2 * (1 + Math.cos(th)) / 2;
                points.push({ x: p0.x + t.x * along - t.y * across, y: p0.y + t.y * along + t.x * across });
            }
            s = loop.s0 + SPAN / 2 + STEP;
            continue;
        }
        add(s);
        s += STEP;
    }
    add(total);

    // Smooth curve through the points (Catmull-Rom as Bezier curves).
    const f = n => n.toFixed(1);
    let out = `M ${f(points[0].x)} ${f(points[0].y)}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i - 1] || points[i], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2] || p2;
        out += ` C ${f(p1.x + (p2.x - p0.x) / 6)} ${f(p1.y + (p2.y - p0.y) / 6)} ` +
            `${f(p2.x - (p3.x - p1.x) / 6)} ${f(p2.y - (p3.y - p1.y) / 6)} ${f(p2.x)} ${f(p2.y)}`;
    }
    return out;
}

let homeLayoutFrame = 0;
function scheduleHomeLayout() {
    cancelAnimationFrame(homeLayoutFrame);
    homeLayoutFrame = requestAnimationFrame(() => layoutHome());
}

function layoutHome() {
    const container = document.getElementById('home-projects');
    const W = container.clientWidth;
    if (!W || !homeItems.length) return;

    // Width of a square in % of the page: [size 20%, size 100%].
    // Computer: a twentieth up to half the page. Tablet and phone: relatively bigger.
    const [minPct, maxPct] = W < 440 ? [16, 80] : W < 760 ? [10, 50] : [5, 50];
    const SCALE = 0.8;                       // everything a bit smaller: the page looks zoomed out
    const small = W < 760;
    const top = 0;                           // the first pictures start right under the intro
    const pad = small ? W * 0.03 : W * 0.07; // pictures stay this far from the sides
    const U = W - 2 * pad;                   // the width the pictures use
    const gapX = Math.max(70, W * 0.06);     // room between neighbours (for the path)
    const gapY = small ? 80 : 110;           // room between rows (for the path)

    // 1. Measure every frame. Size sets the side of a square; other proportions get the same
    //    area (a 16:9 frame is wider and lower than the square, a 9:16 one narrower and taller).
    const boxes = homeItems.map(item => {
        const widthPct = minPct + (item.size - 20) / 80 * (maxPct - minPct);
        const side = W * widthPct / 100 * SCALE;
        const w = Math.min(U, side * Math.sqrt(item.frame));
        item.card.style.width = w + 'px';
        item.card.querySelector('.project-image').style.aspectRatio = String(item.frame);
        return { item, w, ph: w / item.frame, h: item.card.offsetHeight };
    });

    // 2. Split into rows: as many as fit next to each other.
    const rows = [];
    let row = [];
    let used = 0;
    boxes.forEach(box => {
        const needed = row.length ? used + gapX + box.w : box.w;
        if (row.length && needed > U) {
            rows.push(row);
            row = [];
            used = 0;
        }
        used = row.length ? used + gapX + box.w : box.w;
        row.push(box);
    });
    if (row.length) rows.push(row);

    // 3. Place each row. Even rows run left -> right, odd rows right -> left.
    let y = top;
    rows.forEach((rowBoxes, r) => {
        const total = rowBoxes.reduce((sum, b) => sum + b.w, 0);
        const isLast = r === rows.length - 1;
        // Full rows spread out over the whole width; the last row keeps normal spacing.
        const gap = rowBoxes.length > 1 && !isLast
            ? Math.max(gapX, (U - total) / (rowBoxes.length - 1))
            : gapX;
        const rowHeight = Math.max(...rowBoxes.map(b => b.h));
        const ltr = r % 2 === 0;
        let x = ltr ? pad : W - pad;
        rowBoxes.forEach(box => {
            // A little up/down variation inside the row keeps it organic (the first row less, so it starts close under the text).
            const drop = ((rowHeight - box.h) * box.item.swing * 0.85 + box.item.spacing * 14) * (r === 0 ? 0.35 : 1);
            box.x = ltr ? x : x - box.w;
            box.y = y + drop;
            box.row = r;
            x = ltr ? x + box.w + gap : x - box.w - gap;
            box.item.card.style.left = box.x + 'px';
            box.item.card.style.top = box.y + 'px';
        });
        y += rowHeight + 14 + gapY;
    });

    const bottom = Math.max(...boxes.map(b => b.y + b.h));
    const height = bottom + 140;             // room for the "Born" splash at the bottom
    container.style.height = height + 'px';

    // 4. One continuous path: from "Born" through the middle of every picture (behind them) up to
    //    the top, where it runs off the screen. Across a row it curves sideways, between rows it swings down.
    const centre = b => ({ x: b.x + b.w / 2, y: b.y + b.ph / 2 });
    const vertical = (a, b) => {
        const k = (a.y - b.y) * 0.95;
        const s = Math.sign(b.x - a.x || 1) * Math.min(W * 0.04, 40);
        return `C ${a.x - s} ${a.y - k} ${b.x + s} ${b.y + k} ${b.x} ${b.y}`;
    };
    const sideways = (a, b) => {
        const half = (b.x - a.x) * 0.5;
        return `C ${a.x + half} ${a.y} ${b.x - half} ${b.y} ${b.x} ${b.y}`;
    };

    const oldest = boxes[boxes.length - 1];
    const start = { x: centre(oldest).x, y: oldest.y + oldest.h + 70 };   // the middle of the "Born" splash
    // The newest end: the path carries on past the newest picture and runs off the side of the screen, high up
    // (towards today, without a label).
    const newest = centre(boxes[0]);
    const pageLeft = container.getBoundingClientRect().left;
    const offLeft = newest.x < W / 2;
    const end = { x: offLeft ? -pageLeft - 80 : W + (document.documentElement.clientWidth - pageLeft - W) + 80, y: 20 };
    let d = `M ${start.x} ${start.y} L ${centre(oldest).x} ${centre(oldest).y} `;
    for (let i = boxes.length - 1; i > 0; i--) {
        const A = centre(boxes[i]), B = centre(boxes[i - 1]);   // older -> newer
        d += (boxes[i].row === boxes[i - 1].row ? sideways(A, B) : vertical(A, B)) + ' ';
    }
    d += sideways(newest, end);
    drawPath(container.querySelector('.home-path'), W, height, d, boxes, centre);

    const startLabel = container.querySelector('.path-start');
    startLabel.style.left = start.x + 'px';
    startLabel.style.top = start.y + 'px';
}

// Draws a path (as if by hand) into an svg of the given size.
function drawPath(svg, width, height, d, boxes, centre) {
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', 'home-path-line');
    path.setAttribute('d', d);
    svg.replaceChildren(path);
    path.setAttribute('d', handDrawn(path, boxes, centre));
}

// Re-draw the trail when the page width changes, the home page becomes visible, or fonts load.
let lastHomeWidth = 0;
new ResizeObserver(entries => {
    const width = Math.round(entries[0].contentRect.width);
    if (width !== lastHomeWidth) {
        lastHomeWidth = width;
        layoutHome();
    }
}).observe(document.getElementById('home-projects'));
if (document.fonts) document.fonts.ready.then(() => layoutHome());

// ---- Events on the Info page: one path down, newest at the top, the pictures swinging
// from side to side, with the same soft white path as the home page. ----
let eventItems = [];
function renderEvents() {
    const container = document.getElementById('events-path');
    container.innerHTML = '';
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'home-path');
    svg.setAttribute('aria-hidden', 'true');
    container.append(svg);
    eventItems = projects.filter(p => p.isEvent).map(project => {
        const card = createCard(project, 'home-project');
        container.append(card);
        return { card, project, frame: project.frame || 1, swing: seededRandom(project.folder)() };
    });
    document.getElementById('events-block').hidden = !eventItems.length;
    layoutEvents();
}
function layoutEvents() {
    const container = document.getElementById('events-path');
    const W = container.clientWidth;
    if (!W || !eventItems.length) return;
    const side = Math.max(110, Math.min(260, W * 0.3));     // a square picture's width
    let y = 40;
    const boxes = eventItems.map((item, i) => {
        const w = Math.min(W, side * Math.sqrt(item.frame));
        item.card.style.width = w + 'px';
        item.card.querySelector('.project-image').style.aspectRatio = String(item.frame);
        const h = item.card.offsetHeight;
        // Left and right of the middle in turn, each a little different.
        const middle = (i % 2 === 0 ? 0.32 : 0.68) + (item.swing - 0.5) * 0.12;
        const x = Math.max(0, Math.min(W - w, W * middle - w / 2));
        item.card.style.left = x + 'px';
        item.card.style.top = y + 'px';
        const box = { x, y, w, h, ph: w / item.frame };
        y += h + 80;
        return box;
    });
    const height = y + 20;
    container.style.height = height + 'px';

    const centre = b => ({ x: b.x + b.w / 2, y: b.y + b.ph / 2 });
    const first = centre(boxes[0]), last = boxes[boxes.length - 1];
    let d = `M ${first.x} 0 L ${first.x} ${first.y} `;
    for (let i = 1; i < boxes.length; i++) {
        const a = centre(boxes[i - 1]), b = centre(boxes[i]), k = (b.y - a.y) * 0.55;
        d += `C ${a.x} ${a.y + k} ${b.x} ${b.y - k} ${b.x} ${b.y} `;
    }
    d += `L ${centre(last).x} ${height}`;
    drawPath(container.querySelector('.home-path'), W, height, d, boxes, centre);
}
let lastEventsWidth = 0;
new ResizeObserver(entries => {
    const width = Math.round(entries[0].contentRect.width);
    if (width !== lastEventsWidth) { lastEventsWidth = width; layoutEvents(); }
}).observe(document.getElementById('events-path'));
if (document.fonts) document.fonts.ready.then(() => layoutEvents());

// ---- The name on the home page always fills the full width of the page ----
// Measure the name at 100px and scale it so its letters run exactly from edge to edge.
// Measured by the ink of the letters (not their boxes): the L has empty space on its left,
// which is pulled back so the L lines up with the text under it.
const nameCanvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
// Where the name's ink really starts and ends, from its drawn pixels: the font's own numbers
// are not exact, and it uses a special k at the end of a word. { left, right } from the start.
function inkOf(text, font, spacing) {
    const g = nameCanvas;
    g.font = font;
    if ('letterSpacing' in g) g.letterSpacing = spacing + 'px';
    const W = Math.ceil(g.measureText(text).width + 200), H = 300;
    g.canvas.width = W;
    g.canvas.height = H;                      // (resizing also resets the drawing settings)
    g.font = font;
    if ('letterSpacing' in g) g.letterSpacing = spacing + 'px';
    g.fillStyle = '#000';
    g.fillText(text, 100, 200);
    const pixels = g.getImageData(0, 0, W, H).data;
    const inkColumn = x => { for (let y = 0; y < H; y++) if (pixels[(y * W + x) * 4 + 3] > 100) return true; return false; };
    let left = 0, right = W - 1;
    while (left < W && !inkColumn(left)) left++;
    while (right > left && !inkColumn(right)) right--;
    return left >= W ? null : { left: left - 100, right: right + 1 - 100 };
}
// The name runs from the left of the logo's blue circle (it has a thin see-through rim: 10 of its 192 pixels)
// to the right of the Instagram circle. Without them in view: the full width of the name's box.
const LOGO_RIM = 10 / 192;
const NAME_SIZE = 0.98;         // a little smaller than that, centred between them
function nameRoom(h1) {
    const box = h1.getBoundingClientRect();
    const logo = document.querySelector('.brand img'), insta = document.querySelector('.instagram-button');
    const l = logo && logo.getBoundingClientRect(), r = insta && insta.getBoundingClientRect();
    if (!l || !r || !l.width || !r.width) return { start: 0, width: h1.clientWidth };
    const logoLeft = (l.left + l.right) / 2 - logo.offsetWidth / 2;          // (not grown by its hover)
    const start = logoLeft + logo.offsetWidth * LOGO_RIM - box.left;
    return { start, width: r.right - box.left - start };
}
const fitName = () => {
    const h1 = document.querySelector('.fit-name');
    const text = h1 && h1.firstElementChild;
    if (!text || !h1.clientWidth) return;
    const { start, width } = nameRoom(h1);
    if (width <= 0) return;
    h1.style.fontSize = '100px';
    text.style.marginLeft = '0px';
    const range = document.createRange();
    range.selectNodeContents(text);
    const measured = range.getBoundingClientRect().width;   // letter boxes, incl. spacing after the last letter
    if (!measured) return;
    // Ink of the first and last letter, compared with their boxes.
    const cs = getComputedStyle(h1);
    const spacing = parseFloat(cs.letterSpacing) || 0;
    const name = text.textContent.trim();
    // (A browser that can't space letters on a canvas would measure the ink too narrow: then the boxes are used.)
    const ink = 'letterSpacing' in nameCanvas ? inkOf(name, `${cs.fontWeight} 100px ${cs.fontFamily}`, spacing) : null;
    const inkWidth = ink ? ink.right - ink.left : 0;
    const scale = NAME_SIZE * width / (inkWidth > 0 ? inkWidth : measured);
    h1.style.fontSize = (100 * scale).toFixed(2) + 'px';
    const indent = start + width * (1 - NAME_SIZE) * 0.35;   // between the logo and Instagram, a touch to the left (looks centred)
    text.style.marginLeft = (indent - (inkWidth > 0 ? ink.left * scale : 0)).toFixed(2) + 'px';   // minus the L's empty space
    // Where the name's letters start and end: the text under it keeps to the same width.
    const copy = h1.closest('.home-copy') || h1.parentElement;
    const inkRight = h1.clientWidth - (indent + (inkWidth > 0 ? inkWidth : measured) * scale);
    copy.style.setProperty('--name-left', Math.max(0, indent).toFixed(1) + 'px');
    copy.style.setProperty('--name-right', Math.max(0, inkRight).toFixed(1) + 'px');
};
new ResizeObserver(fitName).observe(document.querySelector('.fit-name'));
if (document.fonts) document.fonts.ready.then(fitName);
fitName();

// ---- Sticky header: the big name on the home page dissolves softly into it while scrolling ----
const topBar = document.getElementById('top-bar');
const bigName = document.querySelector('.fit-name');
// Height of the soft zone under the header where the name fades out (a bit more for a bigger name).
const fadeLength = () => Math.min(80, Math.max(40, parseFloat(getComputedStyle(bigName).fontSize) * 0.28));
let headerQueued = false;
function updateHeaderName() {
    headerQueued = false;
    const onHome = document.getElementById('home').classList.contains('active');
    if (onHome) {
        const line = topBar.getBoundingClientRect().bottom;
        const box = bigName.getBoundingClientRect();
        // Where the material line is, measured inside the name.
        const cut = line - box.top;
        // A fixed soft zone right under the header: the letters fade as they pass through it.
        // It never changes size, so nothing pops; at the top of the page the name sits below it.
        const soft = fadeLength();
        if (cut + soft > 0) {
            const mask = `linear-gradient(to bottom, transparent ${cut.toFixed(1)}px, #000 ${(cut + soft).toFixed(1)}px)`;
            bigName.style.webkitMaskImage = mask;
            bigName.style.maskImage = mask;
        } else {
            bigName.style.webkitMaskImage = '';
            bigName.style.maskImage = '';
        }
    }
}
const queueHeaderName = () => {
    if (!headerQueued) { headerQueued = true; requestAnimationFrame(updateHeaderName); }
};
window.addEventListener('scroll', queueHeaderName, { passive: true });
window.addEventListener('resize', queueHeaderName);
window.addEventListener('hashchange', () => setTimeout(updateHeaderName, 0));
if (document.fonts) document.fonts.ready.then(updateHeaderName);
updateHeaderName();

function renderGrid() {
    const grid = document.getElementById('project-grid');
    grid.innerHTML = '';
    // Material pages: the most important (biggest on the home page) first, then newest.
    [...projects].sort((a, b) => b.size - a.size || (b.date ?? -Infinity) - (a.date ?? -Infinity))
        .forEach(project => grid.append(createCard(project, 'project')));
}

function renderDetail(project) {
    setColor(document.getElementById('project'), project.isEvent ? 'event' : project.categories[0]);
    document.getElementById('detail-title').textContent = project.name;
    requestAnimationFrame(fitDetailTitle);
    document.getElementById('detail-kind').textContent = project.kind;
    document.getElementById('detail-intro').textContent = project.short;
    document.title = `${project.name} — Levi Lingerak`;

    const text = document.getElementById('detail-text');
    text.innerHTML = '';
    if (project.storyTitle) {                     // the story's own title (optional)
        const h = document.createElement('h2');
        h.className = 'detail-story-title';
        h.textContent = project.storyTitle;
        text.append(h);
    }
    if (project.detail) text.append(...toParagraphs(project.detail));

    // A project: its picture at the top, right of the title, and the facts at the bottom of the page.
    // An event: no picture there, its facts at the top in the right half.
    const topPicture = document.getElementById('detail-top-picture');
    const topIndexes = project.isEvent ? [] : project.top.map(file => project.mediaFiles.indexOf(file));
    topPicture.innerHTML = '';
    topPicture.hidden = !topIndexes.length;
    topPicture.classList.toggle('is-pair', topIndexes.length === 2);
    topIndexes.forEach(i => {
        const img = document.createElement('img');
        img.src = project.media[i].url;
        img.alt = project.media[i].caption || project.name;
        img.decoding = 'async';
        // Two upright pictures: widths in proportion, so both are just as high.
        const share = () => { if (img.naturalWidth) img.style.flexGrow = String(img.naturalWidth / img.naturalHeight); };
        if (img.complete) share(); else img.addEventListener('load', share, { once: true });
        topPicture.append(img);
    });
    document.querySelector('#project .detail-top').classList.toggle('has-picture', topIndexes.length > 0);
    const facts = document.getElementById('detail-facts');
    (project.isEvent ? document.querySelector('#project .detail-top') : document.getElementById('detail-facts-end')).append(facts);
    facts.innerHTML = '';
    project.facts.forEach(([label, value]) => {
        const pair = document.createElement('div');     // (a label with its value, kept together in the columns)
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
        pair.append(dt, dd);
        facts.append(pair);
    });

    showFilm(project);

    const gallery = document.getElementById('detail-gallery');
    gallery.innerHTML = '';
    project.media.forEach((item, i) => {
        if (i === 0 && project.youtube && !item.isVideo) return;   // a film's thumbnail: the film itself is above
        if (topIndexes.includes(i)) return;                              // already at the top, right of the title
        const figure = document.createElement('figure');
        if (item.isVideo) {
            const video = document.createElement('video');
            video.src = item.url;
            video.controls = true;
            video.playsInline = true;
            video.preload = 'metadata';
            figure.append(video);
            figure.className = 'is-wide';
        } else {
            const img = document.createElement('img');
            img.src = item.url;
            img.alt = item.caption || `${project.name} — image ${i + 1}`;
            img.loading = i < 2 ? 'eager' : 'lazy';
            img.decoding = 'async';
            figure.append(img);
            // Every picture in its own proportion (square, 4:3, 3:4, 16:9 or 9:16).
            // The cover spans the full width when it is wide; an upright cover sits beside the next picture.
            const shape = ratio => {
                figure.style.aspectRatio = String(ratio);
                figure.classList.toggle('is-wide', i === 0 && ratio > 1);
            };
            if (i === 0) figure.classList.add('is-cover');
            if (i === 0 && project.frame) shape(project.frame);
            const measure = () => { if (img.naturalWidth) shape(nearestFrame(img.naturalWidth / img.naturalHeight)); };
            if (img.complete) measure(); else img.addEventListener('load', measure, { once: true });
        }
        if (item.caption) {
            if (item.isVideo) figure.querySelector('video').setAttribute('aria-label', item.caption);
            if (SHOW_PICTURE_TEXTS) {
                const caption = document.createElement('figcaption');
                caption.textContent = item.caption;
                figure.append(caption);
            }
        }
        gallery.append(figure);
    });

    const withPage = projects.filter(p => p.hasPage);   // previous / next skip projects without a page
    const i = withPage.indexOf(project);
    const prev = withPage[(i - 1 + withPage.length) % withPage.length];
    const next = withPage[(i + 1) % withPage.length];
    const prevLink = document.getElementById('detail-prev');
    const nextLink = document.getElementById('detail-next');
    prevLink.href = '#project/' + encodeURIComponent(prev.folder);
    prevLink.textContent = '← ' + prev.name;
    nextLink.href = '#project/' + encodeURIComponent(next.folder);
    nextLink.textContent = next.name + ' →';

    showDesignedPage(project);
}

// A film on YouTube: its player at the top of the project page, under the title and facts.
// (Called without a project when leaving the page, so the film stops.)
function showFilm(project) {
    const box = document.getElementById('detail-video');
    const src = project && project.youtube
        ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(project.youtube)}?rel=0` : '';
    box.hidden = !src;
    const current = box.querySelector('iframe');
    if (current && current.dataset.src === src) return;
    box.innerHTML = '';
    if (!src) return;
    const frame = document.createElement('iframe');
    frame.src = frame.dataset.src = src;
    frame.title = project.name;
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    box.append(frame);
}

// The title stays inside the left half: a long name gets smaller instead of running on.
function fitDetailTitle() {
    const title = document.getElementById('detail-title');
    const room = title.clientWidth;      // (its column, without the room kept free beside the picture)
    title.style.fontSize = '';
    if (!room || !title.textContent) return;
    const wide = title.scrollWidth;
    if (wide > room) {
        const size = parseFloat(getComputedStyle(title).fontSize);
        title.style.fontSize = (size * room / wide * 0.98).toFixed(1) + 'px';
    }
    PageLayout.alignFacts(title, document.getElementById('detail-facts'));
    PageLayout.alignPicture(title, document.getElementById('detail-top-picture'));
}
window.addEventListener('resize', () => requestAnimationFrame(fitDetailTitle));
if (document.fonts) document.fonts.ready.then(fitDetailTitle);

// ---- A designed page (layout.json from the Site Editor): replaces the story and the pictures
// (the top with title, description and facts always stays). ----
function showDefaultPage(show) {
    document.querySelector('#project .detail-body').hidden = !show;
    document.getElementById('detail-gallery').hidden = !show;
    document.getElementById('detail-custom').hidden = show;
}
async function showDesignedPage(project) {
    if (project.layout === undefined) {          // not looked for yet
        project.layout = null;
        try {
            const response = await fetch(encodeURI(`Projects/${project.folder}/layout.json`), { cache: 'no-cache' });
            if (response.ok) project.layout = await response.json();
        } catch (e) { /* no designed page: the automatic one stays */ }
    }
    const current = decodeURIComponent(location.hash.slice(1)) === 'project/' + project.folder;
    if (!current) return;                        // the visitor already went elsewhere
    if (!project.layout || !(project.layout.bands || []).length) { showDefaultPage(true); return; }
    const captions = Object.fromEntries(project.media.map((m, i) => [project.mediaFiles[i], m.caption]));
    PageLayout.render(document.getElementById('detail-custom'), project.layout, {
        name: project.name,
        story: project.detail,
        storyTitle: project.storyTitle,
        photoUrl: file => project.mediaFiles.includes(file) ? mediaUrl(project.folder, file) : '',
        caption: file => captions[file] || ''
    });
    showDefaultPage(false);
}

// ---- Material colours and texts: Projects/materials.json (made in the Site Editor's Materials tab) ----
// A changed colour replaces the one above, for the dots, lines, lettering and the background alike.
async function loadMaterials() {
    let list = [];
    try {
        const response = await fetch('Projects/materials.json', { cache: 'no-cache' });
        if (response.ok) list = (await response.json()).materials || [];
    } catch (e) { /* no file: the colours above */ }
    list.forEach(m => {
        const category = categoryById[m.id];
        if (!category) return;
        category.description = String(m.description || '').trim();
        if (/^#[0-9a-f]{6}$/i.test(m.color || '') && m.color.toLowerCase() !== category.color.toLowerCase()) {
            category.color = m.color;
            category.ink = m.color;                                       // the lettering in exactly this colour
            const blob = document.querySelector('.blob-' + m.id);       // the background takes the new colour too
            if (blob) blob.style.setProperty('--c', m.color);
        }
    });
    document.querySelectorAll('.category-link').forEach(link => setColor(link, link.dataset.page));
}

async function loadProjects() {
    await loadMaterials();
    let list = [];
    try {
        const response = await fetch('Projects/projects.json', { cache: 'no-cache' });
        // "hidden": true (set in the Site Editor): not on the site at all, not even its own page.
        list = ((await response.json()).projects || []).filter(entry => entry.hidden !== true);
    } catch (e) {
        console.error('Could not load Projects/projects.json', e);
    }

    projects = await Promise.all(list.map(loadProject));
    // Newest first; projects without a date keep their order from projects.json.
    projects.sort((a, b) => (b.date ?? -Infinity) - (a.date ?? -Infinity) || a.index - b.index);
    projectsLoaded = true;

    renderHome();
    renderEvents();
    renderGrid();
    route();
}

// ---- Profile (Profile/profile.txt). Empty fields keep the text already on the page. ----
async function loadProfile() {
    let data;
    try {
        const response = await fetch('Profile/profile.txt', { cache: 'no-cache' });
        if (!response.ok) return;
        data = parseInfoFile(await response.text(), PROFILE_KEYS);
    } catch (e) { return; }

    document.querySelectorAll('[data-profile]').forEach(el => {
        const value = data[el.dataset.profile];
        if (!value) return;
        if (el.dataset.profile === 'biography') el.replaceChildren(...toParagraphs(value));
        else if (el.dataset.profile === 'short introduction') el.replaceChildren(...introParts(value));
        else el.textContent = value;
        el.hidden = false;
    });

    if (data['email']) {
        document.querySelectorAll('.profile-email').forEach(a => {
            a.href = 'mailto:' + data['email'];
            a.textContent = data['email'] + ' ↗';
        });
    }

    const handle = (data['instagram'] || '').replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/+$/, '');
    if (handle) {
        document.querySelectorAll('a[href*="instagram.com"]').forEach(a => {
            a.href = `https://www.instagram.com/${encodeURIComponent(handle)}/`;
        });
        document.querySelectorAll('.profile-instagram').forEach(a => {
            a.textContent = `Instagram @${handle} ↗`;
        });
        document.querySelectorAll('.profile-instagram-handle').forEach(a => {
            a.textContent = `@${handle} ↗`;
        });
    }
}

// ---- Background blobs: a small live simulation ----
// Every blob floats towards its own spot (the home set in style.css, --x / --y) with a slow drift of its own,
// and moves up slower than the page when scrolling, by its own depth. Blobs keep their distance from each other:
// they may overlap a little when they pass, never fully. On a material page that material's blob floats behind its
// big name (in the material's own colour, a bit lighter) and the blob that was there moves to where it came from.
const blobEls = Object.fromEntries([...document.querySelectorAll('.blob')]
    .map(el => [(el.className.match(/blob-(\w+)/) || [])[1], el]).filter(([id]) => id));
const BLOBS = Object.entries(blobEls).map(([id, el], i) => ({
    id, el, i, x: NaN, y: NaN, vx: 0, vy: 0,
    seed: i * 1.7 + 0.4,
    period: parseFloat(getComputedStyle(el).getPropertyValue('--speed')) || 46     // seconds for one slow drift
}));
let featured = null;          // the blob behind the material's name
let featureSpot = null;       // { x, y }: the middle of that name, on the screen (as at the top of the page)
let giveWay = null;           // { blob, x, y }: the blob that was there, and where it goes instead
const vmax = () => Math.max(window.innerWidth, window.innerHeight) / 100;
// A blob's place in the home set: the middle of it, in pixels. (Read from style.css once, until the window
// changes size: arrangeBlobs.)
const homes = new Map();
function homeSpot(b) {
    if (homes.has(b)) return homes.get(b);
    const cs = getComputedStyle(b.el);
    const px = (value, full) => {
        const v = value.trim(), n = parseFloat(v) || 0;
        return v.endsWith('%') ? n * full / 100 : v.endsWith('vmax') ? n * vmax() : n;
    };
    const spot = { x: px(cs.getPropertyValue('--x'), window.innerWidth) + px(cs.getPropertyValue('--w'), 0) / 2,
                   y: px(cs.getPropertyValue('--y'), window.innerHeight) + px(cs.getPropertyValue('--h'), 0) / 2 };
    homes.set(b, spot);
    return spot;
}
function anchorOf(b) {
    if (b === featured && featureSpot) return featureSpot;
    if (giveWay && b === giveWay.blob) return giveWay;
    return homeSpot(b);
}
function arrangeBlobs(materialId) {
    homes.clear();                               // (the window may have changed size)
    BLOBS.forEach(b => b.el.classList.remove('is-feature'));
    featured = featureSpot = giveWay = null;
    const b = BLOBS.find(x => x.id === materialId);
    document.querySelector('.bg-blobs').classList.toggle('on-material', !!b);   // (the other blobs step back)
    const r = b ? document.getElementById('category-title').getBoundingClientRect() : null;
    if (b && r.width) {
        featured = b;
        // (the middle of the word itself, without the room around it that the reveal needs: style.css #category-title)
        const pad = getComputedStyle(document.getElementById('category-title'));
        const top = r.top + parseFloat(pad.paddingTop), bottom = r.bottom - parseFloat(pad.paddingBottom);
        featureSpot = { x: r.left + r.width / 2, y: (top + bottom) / 2 + window.scrollY };
        b.el.style.setProperty('--fc', (categoryById[b.id] || {}).color || '');   // the material's own colour
        b.el.classList.add('is-feature');
        // The blob whose home is nearest to the name (if it is close) takes this one's home instead.
        const from = homeSpot(b);
        let near = null, best = Infinity;
        BLOBS.forEach(o => {
            if (o === b) return;
            const s = homeSpot(o), d = Math.hypot(s.x - featureSpot.x, s.y - featureSpot.y);
            if (d < best) { best = d; near = o; }
        });
        if (near && best < Math.max(window.innerWidth, window.innerHeight) * 0.4) giveWay = { blob: near, x: from.x, y: from.y };
    }
    // The name appears as its blob glides in behind it (hidden where the blob isn't yet).
    revealing = !!featured && !reduceMotion;
    revealName();
    if (reduceMotion) placeBlobs();
}
// The material's name shows only where its blob is: a soft round window that follows the blob, so the word
// appears while the blob moves in behind it. Once the blob has settled, the name is simply there.
let revealing = false;
function revealName() {
    const title = document.getElementById('category-title');
    const b = featured;
    const clear = () => { title.style.maskImage = title.style.webkitMaskImage = ''; };
    if (!revealing || !b) { clear(); return; }
    if (Number.isNaN(b.x)) { const h = homeSpot(b); b.x = h.x; b.y = h.y; }      // (not placed yet: from its home)
    const r = title.getBoundingClientRect();
    if (!r.width) return;
    const settled = Math.hypot(b.x - featureSpot.x, b.y - featureSpot.y) < 40 && Math.hypot(b.vx, b.vy) < 25;   // (it keeps a tiny drift)
    if (settled) { revealing = false; clear(); return; }
    const radius = ((b.w || b.el.offsetWidth) + (b.h || b.el.offsetHeight)) / 4;   // about the blob's size
    const mask = `radial-gradient(circle ${radius.toFixed(0)}px at ${(b.x - r.left).toFixed(0)}px ${(b.y - r.top).toFixed(0)}px, #000 45%, transparent 100%)`;
    title.style.maskImage = title.style.webkitMaskImage = mask;
}
// Its size: measured once per frame (it changes when it grows behind a material's name).
const measureBlob = b => { b.w = b.el.offsetWidth; b.h = b.el.offsetHeight; };
const placeBlob = b => {
    b.el.style.translate = `${(b.x - b.w / 2).toFixed(1)}px ${(b.y - b.h / 2).toFixed(1)}px`;
};
function placeBlobs() {           // (no motion: straight to their spots)
    BLOBS.forEach(b => { const a = anchorOf(b); b.x = a.x; b.y = a.y; measureBlob(b); placeBlob(b); });
}
const currentMaterial = () => {
    const hash = decodeURIComponent(window.location.hash.replace('#', ''));
    return categoryById[hash] ? hash : null;
};
window.addEventListener('resize', () => requestAnimationFrame(() => arrangeBlobs(currentMaterial())));
if (document.fonts) document.fonts.ready.then(() => arrangeBlobs(currentMaterial()));   // (the name's size is known)
document.querySelector('.bg-blobs').classList.add('is-live');   // (placed by this script from now on)
if (reduceMotion) placeBlobs();
else {
    let last = performance.now();
    const step = now => {
        // In small steps, so a slow screen (few frames) still moves them at the same pace.
        let left = Math.min(0.5, (now - last) / 1000);
        BLOBS.forEach(measureBlob);
        const sizes = BLOBS.map(b => (b.w + b.h) / 4);
        while (left > 0) {
            const dt = Math.min(1 / 30, left);
            left -= dt;
            simulate(dt, (now - left * 1000) / 1000, sizes);
        }
        last = now;
        BLOBS.forEach(placeBlob);
        if (revealing) revealName();
        requestAnimationFrame(step);
    };
    // How near each blob is: the part of the scrolling it moves along with (far ones slow, nearer ones faster).
    const DEPTHS = [0.45, 0.3, 0.6, 0.38, 0.53, 0.34];
    const simulate = (dt, t, sizes) => {
        const v = vmax(), scroll = window.scrollY, W = window.innerWidth, H = window.innerHeight;
        BLOBS.forEach(b => {
            const a = anchorOf(b);
            let tx = a.x, ty = a.y;
            if (b !== featured) {
                // Its own slow drift …
                tx += Math.sin(t * 2 * Math.PI / b.period + b.seed) * 7 * v;
                ty += Math.sin(t * 2 * Math.PI / (b.period * 1.3) + b.seed * 2) * 6 * v;
                // … and depth: it moves up with the scrolling, slower than the page (far ones slowest), like a layer
                // further back. Once it has floated out at the top it comes back in at the bottom (and the other
                // way round), out of sight, so the screen never runs empty.
                const size = b.h * 0.7, span = H + 2 * size;   // (half of it, plus its swell and turn)
                const depth = DEPTHS[b.i % DEPTHS.length];
                ty -= scroll * depth;
                // (the scrolling moves it straight away; the springiness is only for its drift and the spacing)
                if (b.seen !== undefined && !Number.isNaN(b.y)) b.y -= (scroll - b.seen) * depth;
                if (b.wrap === undefined) b.wrap = Math.round((H / 2 - ty) / span);   // (start on the screen)
                if (!Number.isNaN(b.y)) {
                    const back = b.y < -size ? 1 : b.y > H + size ? -1 : 0;
                    if (back) {
                        b.wrap += back; b.y += back * span;
                        // Comes back in where there is most room across the width (away from the others near there).
                        let best = b.x, bestRoom = -1;
                        for (let k = 0; k <= 8; k++) {
                            const x = W * (0.05 + 0.9 * k / 8);
                            const room = Math.min(...BLOBS.filter(o => o !== b).map(o => Math.hypot(o.x - x, (o.y - b.y) * 1.4)));
                            if (room > bestRoom) { bestRoom = room; best = x; }
                        }
                        b.lane = best; b.x = best; b.vx = 0;
                    }
                }
                ty += b.wrap * span;
                if (b.lane !== undefined && !(giveWay && giveWay.blob === b)) tx += b.lane - a.x;
            } else {
                tx += Math.sin(t * 0.25 + b.seed) * 0.8 * v;       // (hardly moves: it stays behind the name)
                ty += Math.cos(t * 0.2 + b.seed) * 0.6 * v;
            }
            if (Number.isNaN(b.x)) { b.x = tx; b.y = ty; }
            b.seen = scroll;
            // Floats towards that spot, a little springy, so it travels in a soft curve.
            b.ax = 2.0 * (tx - b.x) - 2.4 * b.vx;
            b.ay = 2.0 * (ty - b.y) - 2.4 * b.vy;
        });
        // Too close: they push each other apart (the blob behind the name stays where it is).
        for (let i = 0; i < BLOBS.length; i++) for (let j = i + 1; j < BLOBS.length; j++) {
            const p = BLOBS[i], q = BLOBS[j];
            const rp = sizes[i], rq = sizes[j];
            const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
            const room = (rp + rq) * 0.62;                          // closer than this: pushed apart hard
            const reach = (rp + rq) * 1.1;                          // closer than this: a gentle push (keeps them spread out)
            if (d >= reach) continue;
            const push = (30 * (reach - d) / reach + (d < room ? 60 * (room - d) / room : 0)) * v, ux = dx / d, uy = dy / d;
            const pw = p === featured ? 0 : q === featured ? 2 : 1, qw = q === featured ? 0 : p === featured ? 2 : 1;
            p.ax -= ux * push * pw; p.ay -= uy * push * pw;
            q.ax += ux * push * qw; q.ay += uy * push * qw;
        }
        BLOBS.forEach(b => {
            b.vx += b.ax * dt; b.vy += b.ay * dt;
            b.x += b.vx * dt; b.y += b.vy * dt;
        });
    };
    requestAnimationFrame(step);
}

route();
loadProfile();
loadProjects();
