
'use strict';
/* ── TYPES & PALETTE ── */
const TYPES = [
    { id: 'character', name: 'Character', icon: '◈', color: '#d4557a' },
    { id: 'location', name: 'Location', icon: '◉', color: '#0098b5' },
    { id: 'item', name: 'Item', icon: '◆', color: '#d46a28' },
    { id: 'event', name: 'Event', icon: '◎', color: '#c82d2d' },
    { id: 'faction', name: 'Faction', icon: '⬡', color: '#7f3bbf' },
    { id: 'concept', name: 'Concept', icon: '◇', color: '#1a9464' },
    { id: 'lore', name: 'Lore', icon: '◐', color: '#2870c8' },
];
const PALETTE = [
    '#d4557a', '#c82d2d', '#d46a28', '#c8920a',
    '#1a9464', '#0098b5', '#2870c8', '#7f3bbf',
    '#e85a8a', '#20b870', '#40a8e8', '#9255d4',
    '#d87530', '#80a820', '#50b8c8', '#c040a0',
];

/* ── STATE ── */
const S = {
    nodes: [], links: [], selNode: null, selLink: null,
    connFrom: null, tool: 'select',
    cam: { x: 0, y: 0, z: 1 }, panning: false, panStart: {},
    dragging: null, tempMouse: null, search: '',
    editNode: null, editTags: [], editColor: PALETTE[0],
    ctxNRef: null, ctxLRef: null,
    kbIdx: -1,
    opts: { theme: 'light', scale: 'normal', grid: true, motion: false, focus: false, cc: true, tags: true }
};

// collaboration metadata
S.collab = {
    peer: null,
    roomCode: null,
    isHost: false,
    connections: new Map(),
    myId: uid().toString(),
    myColor: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    collaborators: new Map()
};

/* ── DOM ── */
const $ = id => document.getElementById(id);
const canv = $('canvas'); // canvas-wrap div

/* ── UTILS ── */
function gt(id) { return TYPES.find(t => t.id === id) || TYPES[0]; }
function nc(n) { return n.color || gt(n.type).color; }
function uid() { return Date.now() + Math.random(); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function say(m) { $('sr-status').textContent = ''; requestAnimationFrame(() => { $('sr-status').textContent = m; }); }

function s2w(sx, sy) {
    const r = canv.getBoundingClientRect();
    return { x: (sx - r.left - S.cam.x) / S.cam.z, y: (sy - r.top - S.cam.y) / S.cam.z };
}

/* ── CAMERA ── */
function applyCamera() {
    const { x, y, z } = S.cam;
    $('world').style.transform = `translate(${x}px,${y}px) scale(${z})`;
    if (S.opts.grid) {
        const g = 32 * z;
        canv.style.backgroundSize = `${g}px ${g}px`;
        canv.style.backgroundPosition = `${x}px ${y}px`;
    }
    $('zoomBadge').textContent = Math.round(z * 100) + '%';
}

/* ── NODES ── */
function createNode(typeId, x, y, skipModal) {
    const t = gt(typeId);
    const n = { id: uid(), type: typeId, name: `New ${t.name}`, desc: '', color: t.color, x, y, tags: [] };
    S.nodes.push(n);
    mountNode(n, true);
    refreshList();
    updateEmpty();
    if (!skipModal) openModal(n);
    autoSave();
    say(`Created ${t.name} node.`);
    return n;
}

function mountNode(n, isNew) {
    let el = document.getElementById('n-' + n.id);
    if (!el) {
        el = document.createElement('div');
        el.id = 'n-' + n.id; el.className = 'node';
        el.setAttribute('role', 'button'); el.setAttribute('tabindex', '-1');
        $('world').appendChild(el);
        if (isNew && !S.opts.motion) el.classList.add('animIn');
        el.addEventListener('mousedown', e => nodeMD(e, n.id));
        el.addEventListener('click', e => nodeClick(e, n.id));
        el.addEventListener('dblclick', e => { e.stopPropagation(); openModal(S.nodes.find(x => x.id === n.id)); });
        el.addEventListener('contextmenu', e => nodeCtx(e, n.id));
        el.addEventListener('keydown', e => nodeKey(e, n.id));
    }
    const c = nc(n);
    el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
    el.style.setProperty('--c', c);
    el.setAttribute('aria-label', `${n.name}, ${n.type}`);
    const cc = S.links.filter(l => l.from === n.id || l.to === n.id).length;
    const ctHtml = (S.opts.cc && cc > 0) ? `<div class="nct">${cc} link${cc !== 1 ? 's' : ''}</div>` : '';
    const tHtml = (S.opts.tags && n.tags.length) ? `<div class="nchips">${n.tags.slice(0, 3).map(t => `<span class="nchip">${t}</span>`).join('')}</div>` : '';
    el.innerHTML = `<div class="nstripe"></div><div class="nrow"><span class="nbadge">${n.type}</span><span class="nicon" aria-hidden="true">${gt(n.type).icon}</span></div><div class="ntitle">${n.name}</div>${ctHtml}${tHtml}`;
    el.classList.toggle('selected', S.selNode === n.id);
    el.classList.toggle('csrc', S.connFrom === n.id);
}

function delNode(id) {
    S.nodes = S.nodes.filter(n => n.id !== id);
    S.links = S.links.filter(l => l.from !== id && l.to !== id);
    document.getElementById('n-' + id)?.remove();
    if (S.selNode === id) { S.selNode = null; S.kbIdx = -1; }
    if (S.connFrom === id) cancelConn();
    renderLinks(); refreshList(); updateEmpty(); autoSave(); say('Node deleted.');
}

function selNode(id) {
    const p = S.selNode; S.selNode = id; S.selLink = null;
    if (p) document.getElementById('n-' + p)?.classList.remove('selected');
    if (id) { document.getElementById('n-' + id)?.classList.add('selected'); S.kbIdx = S.nodes.findIndex(n => n.id === id); }
    else S.kbIdx = -1;
    refreshList();
}

function nodeKey(e, id) {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (S.tool === 'connect') nodeClick(e, id);
        else openModal(S.nodes.find(n => n.id === id));
    }
}

/* ── LINKS ── */
function createLink(from, to) {
    if (S.links.find(l => (l.from === from && l.to === to) || (l.from === to && l.to === from))) return;
    S.links.push({ id: uid(), from, to, label: '' });
    [from, to].forEach(id => { const n = S.nodes.find(x => x.id === id); if (n) mountNode(n); });
    renderLinks(); autoSave();
    const fn = S.nodes.find(n => n.id === from), tn = S.nodes.find(n => n.id === to);
    say(`Connected ${fn?.name || 'node'} to ${tn?.name || 'node'}.`);
}

function renderLinks() {
    const svg = $('svgLayer');
    const defs = svg.querySelector('defs');
    svg.innerHTML = '';
    if (defs) svg.appendChild(defs);
    if (S.connFrom && S.tempMouse) {
        const fn = S.nodes.find(n => n.id === S.connFrom);
        if (fn) svg.appendChild(mkL(fn.x, fn.y, S.tempMouse.x, S.tempMouse.y, 'var(--accent)', 1.5, true, null, .4));
    }
    for (const lk of S.links) {
        const fn = S.nodes.find(n => n.id === lk.from), tn = S.nodes.find(n => n.id === lk.to);
        if (!fn || !tn) continue;
        const dx = tn.x - fn.x, dy = tn.y - fn.y, d = Math.hypot(dx, dy); if (d < 2) continue;
        const nx = dx / d, ny = dy / d, r = 68;
        const x1 = fn.x + nx * r, y1 = fn.y + ny * r, x2 = tn.x - nx * (r + 9), y2 = tn.y - ny * (r + 9);
        const isSel = S.selLink === lk.id;
        const hit = mkL(x1, y1, x2, y2, 'transparent', 15);
        hit.setAttribute('pointer-events', 'stroke'); hit.style.cursor = 'pointer';
        hit.addEventListener('mousedown', e => e.stopPropagation());
        hit.addEventListener('click', e => { e.stopPropagation(); S.selLink = lk.id; S.selNode = null; renderLinks(); refreshList(); });
        hit.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); S.ctxLRef = lk; showMenu($('ctxL'), e.clientX, e.clientY); });
        $('svgLayer').appendChild(hit);
        $('svgLayer').appendChild(mkL(x1, y1, x2, y2, 'var(--accent)', 1.5, false, isSel ? 'url(#arrs)' : 'url(#arr)', isSel ? 1 : .5));
        if (lk.label) {
            const mx = (fn.x + tn.x) / 2, my = (fn.y + tn.y) / 2;
            const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bg.setAttribute('x', mx - 28); bg.setAttribute('y', my - 7); bg.setAttribute('width', 56); bg.setAttribute('height', 14);
            bg.setAttribute('rx', 3); bg.setAttribute('fill', 'var(--surface)'); $('svgLayer').appendChild(bg);
            const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            txt.setAttribute('x', mx); txt.setAttribute('y', my); txt.setAttribute('text-anchor', 'middle');
            txt.setAttribute('dominant-baseline', 'middle'); txt.setAttribute('fill', 'var(--text-mid)');
            txt.setAttribute('font-size', '10'); txt.setAttribute('font-family', 'Nunito Sans,sans-serif');
            txt.textContent = lk.label; $('svgLayer').appendChild(txt);
        }
    }
}

function mkL(x1, y1, x2, y2, stroke, w, dash, me, opa = 1) {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
    l.setAttribute('stroke', stroke); l.setAttribute('stroke-width', w); l.setAttribute('opacity', opa);
    if (dash) l.setAttribute('stroke-dasharray', '6,4');
    if (me) l.setAttribute('marker-end', me);
    return l;
}

/* ── CONNECT ── */
function startConn(id) {
    S.connFrom = id;
    document.getElementById('n-' + id)?.classList.add('csrc');
    $('connBanner').classList.add('on');
    canv.classList.add('connecting');
    say(`Connection started. Click another node to connect. Esc to cancel.`);
}
function cancelConn() {
    if (S.connFrom) document.getElementById('n-' + S.connFrom)?.classList.remove('csrc');
    S.connFrom = null; S.tempMouse = null;
    $('connBanner').classList.remove('on');
    canv.classList.remove('connecting');
    renderLinks();
}

/* ── CANVAS EVENTS ── */
function nodeMD(e, id) {
    if (e.button !== 0 || S.tool === 'connect') return;
    e.stopPropagation();
    const wp = s2w(e.clientX, e.clientY), n = S.nodes.find(x => x.id === id);
    S.dragging = { id, sx: n.x, sy: n.y, mx: wp.x, my: wp.y };
    selNode(id); canv.classList.add('panning');
}
function nodeClick(e, id) {
    e.stopPropagation();
    if (S.tool !== 'connect') return;
    if (!S.connFrom) { startConn(id); return; }
    if (S.connFrom !== id) { createLink(S.connFrom, id); cancelConn(); }
    else cancelConn();
}
function nodeCtx(e, id) {
    e.preventDefault(); e.stopPropagation();
    S.ctxNRef = S.nodes.find(n => n.id === id); selNode(id);
    showMenu($('ctxN'), e.clientX, e.clientY);
}

canv.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const ok = e.target === canv || e.target === $('world') || e.target.tagName === 'svg' || e.target.tagName === 'SVG' || e.target === $('svgLayer');
    if (!ok) return;
    if (S.tool === 'connect' && S.connFrom) { cancelConn(); return; }
    S.panning = true;
    S.panStart = { mx: e.clientX, my: e.clientY, cx: S.cam.x, cy: S.cam.y };
    canv.classList.add('panning'); selNode(null); S.selLink = null; renderLinks();
});
document.addEventListener('mousemove', e => {
    if (S.dragging) {
        const wp = s2w(e.clientX, e.clientY), d = S.dragging, n = S.nodes.find(x => x.id === d.id);
        n.x = d.sx + (wp.x - d.mx); n.y = d.sy + (wp.y - d.my);
        const el = document.getElementById('n-' + n.id);
        if (el) { el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
        renderLinks();
    } else if (S.panning) {
        S.cam.x = S.panStart.cx + (e.clientX - S.panStart.mx);
        S.cam.y = S.panStart.cy + (e.clientY - S.panStart.my);
        applyCamera();
    }
    if (S.connFrom) { S.tempMouse = s2w(e.clientX, e.clientY); renderLinks(); }
});
document.addEventListener('mouseup', () => {
    if (S.dragging) autoSave();
    S.dragging = null; S.panning = false; canv.classList.remove('panning');
});
canv.addEventListener('dblclick', e => {
    const ok = e.target === canv || e.target === $('world') || e.target.tagName === 'svg' || e.target.tagName === 'SVG' || e.target === $('svgLayer');
    if (!ok) return;
    const wp = s2w(e.clientX, e.clientY); createNode('character', wp.x, wp.y);
});
canv.addEventListener('wheel', e => {
    e.preventDefault();
    const oz = S.cam.z; S.cam.z = clamp(oz * (e.deltaY > 0 ? .9 : 1.1), .08, 6);
    const r = canv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    S.cam.x = mx - (mx - S.cam.x) * (S.cam.z / oz); S.cam.y = my - (my - S.cam.y) * (S.cam.z / oz);
    applyCamera();
}, { passive: false });
canv.addEventListener('contextmenu', e => { if (e.target === canv) e.preventDefault(); });

/* ── KEYBOARD ── */
document.addEventListener('keydown', e => {
    const inField = e.target.matches('input,textarea,select,button');
    if (inField) return;
    const sn = S.selNode && S.nodes.find(n => n.id === S.selNode);
    if (e.key === 'Escape') { if (S.connFrom) cancelConn(); else { selNode(null); S.selLink = null; renderLinks(); } }
    if (e.key === 's') setTool('select');
    if (e.key === 'c') setTool('connect');
    if (e.key === 'e' && sn) openModal(sn);
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.target.matches('input,textarea')) {
        if (S.selNode) { delNode(S.selNode); autoSave(); }
        else if (S.selLink) { S.links = S.links.filter(l => l.id !== S.selLink); S.selLink = null; renderLinks(); autoSave(); say('Connection deleted.'); }
    }
    if (e.key === 'Tab' && canv === document.activeElement) {
        e.preventDefault();
        if (!S.nodes.length) return;
        S.kbIdx = (S.kbIdx + (e.shiftKey ? -1 : 1) + S.nodes.length) % S.nodes.length;
        const n = S.nodes[S.kbIdx]; selNode(n.id);
        const r = canv.getBoundingClientRect();
        S.cam.x = r.width / 2 - n.x * S.cam.z; S.cam.y = r.height / 2 - n.y * S.cam.z;
        applyCamera(); say(`${n.name}, ${n.type}`);
    }
    if (sn && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const st = e.shiftKey ? 40 : 8;
        if (e.key === 'ArrowUp') sn.y -= st;
        if (e.key === 'ArrowDown') sn.y += st;
        if (e.key === 'ArrowLeft') sn.x -= st;
        if (e.key === 'ArrowRight') sn.x += st;
        const el = document.getElementById('n-' + sn.id);
        if (el) { el.style.left = sn.x + 'px'; el.style.top = sn.y + 'px'; }
        renderLinks(); autoSave();
    }
    if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); exportJSON(); }
});

/* ── TOOLS ── */
function setTool(t) {
    S.tool = t;
    const bs = $('toolSel'), bc = $('toolCon');
    bs.setAttribute('aria-pressed', t === 'select' ? 'true' : 'false'); bs.classList.toggle('active', t === 'select');
    bc.setAttribute('aria-pressed', t === 'connect' ? 'true' : 'false'); bc.classList.toggle('active', t === 'connect');
    if (t === 'select') cancelConn();
    canv.classList.toggle('connecting', t === 'connect');
}
$('toolSel').addEventListener('click', () => setTool('select'));
$('toolCon').addEventListener('click', () => setTool('connect'));

/* ── CONTEXT MENUS ── */
let prevF = null;
function showMenu(el, x, y) {
    hideMenus(); prevF = document.activeElement;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.classList.add('on');
    const first = el.querySelector('.ctx-it'); if (first) first.focus();
    const items = [...el.querySelectorAll('.ctx-it')];
    el._kh = ev => {
        if (ev.key === 'Escape') { hideMenus(); prevF?.focus(); }
        if (ev.key === 'ArrowDown') { ev.preventDefault(); const i = items.indexOf(document.activeElement); items[(i + 1) % items.length]?.focus(); }
        if (ev.key === 'ArrowUp') { ev.preventDefault(); const i = items.indexOf(document.activeElement); items[(i - 1 + items.length) % items.length]?.focus(); }
    };
    document.addEventListener('keydown', el._kh);
}
function hideMenus() {
    document.querySelectorAll('.ctx').forEach(m => { if (m._kh) document.removeEventListener('keydown', m._kh); m.classList.remove('on'); });
}
document.addEventListener('click', hideMenus);

$('ctxN').querySelectorAll('.ctx-it').forEach(it => {
    it.addEventListener('click', e => {
        e.stopPropagation(); const n = S.ctxNRef; if (!n) return;
        switch (it.dataset.a) {
            case 'edit': openModal(n); break;
            case 'conn': setTool('connect'); startConn(n.id); break;
            case 'dup': {
                const dn = { ...n, id: uid(), x: n.x + 40, y: n.y + 40, tags: [...n.tags], name: n.name + ' (copy)' };
                S.nodes.push(dn); mountNode(dn, true); refreshList(); autoSave(); say(`Duplicated ${n.name}`);
                break;
            }
            case 'del': delNode(n.id); autoSave(); break;
        }
        hideMenus(); prevF?.focus();
    });
});
$('ctxL').querySelectorAll('.ctx-it').forEach(it => {
    it.addEventListener('click', e => {
        e.stopPropagation(); const lk = S.ctxLRef; if (!lk) return;
        if (it.dataset.a === 'del-link') {
            S.links = S.links.filter(l => l.id !== lk.id); S.selLink = null; renderLinks();
            [lk.from, lk.to].forEach(id => { const n = S.nodes.find(x => x.id === id); if (n) mountNode(n); });
            autoSave(); say('Connection deleted.');
        }
        hideMenus(); prevF?.focus();
    });
});

/* ── SIDEBAR ── */
function initSidebar() {
    const g = $('typeGrid'); g.innerHTML = '';
    TYPES.forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'type-btn'; btn.setAttribute('aria-label', `Create ${t.name} node`);
        btn.innerHTML = `<span class="tpip" style="background:${t.color}" aria-hidden="true"></span>${t.name}`;
        btn.addEventListener('click', () => {
            const r = canv.getBoundingClientRect();
            const wp = s2w(r.left + r.width / 2 + (Math.random() - .5) * 90, r.top + r.height / 2 + (Math.random() - .5) * 90);
            createNode(t.id, wp.x, wp.y);
        });
        g.appendChild(btn);
    });
    const sel = $('fType'); sel.innerHTML = '';
    TYPES.forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; sel.appendChild(o); });
}

function refreshList() {
    const q = S.search.toLowerCase();
    const vis = S.nodes.filter(n => !q || n.name.toLowerCase().includes(q) || n.type.includes(q) || n.tags.some(t => t.toLowerCase().includes(q)));
    $('nodesList').innerHTML = ''; $('nodeCount').textContent = S.nodes.length;
    vis.forEach(n => {
        const div = document.createElement('div');
        div.className = 'nli' + (S.selNode === n.id ? ' active' : '');
        div.setAttribute('role', 'listitem'); div.setAttribute('tabindex', '0');
        div.setAttribute('aria-label', `${n.name}, ${n.type}${S.selNode === n.id ? ', selected' : ''}`);
        div.innerHTML = `<div class="nldot" style="background:${nc(n)}" aria-hidden="true"></div><span class="nlname">${n.name}</span><span class="nltype">${n.type}</span>`;
        const go = () => { selNode(n.id); const r = canv.getBoundingClientRect(); S.cam.x = r.width / 2 - n.x * S.cam.z; S.cam.y = r.height / 2 - n.y * S.cam.z; applyCamera(); say(`Navigated to ${n.name}`); };
        div.addEventListener('click', go);
        div.addEventListener('dblclick', () => openModal(n));
        div.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        $('nodesList').appendChild(div);
    });
}
$('searchInput').addEventListener('input', e => { S.search = e.target.value; refreshList(); });

/* ── MODAL ── */
let mRF = null;
function openModal(node) {
    if (!node) return;
    S.editNode = node; S.editTags = [...node.tags]; S.editColor = node.color || gt(node.type).color;
    mRF = document.activeElement;
    $('mTitle').textContent = node.name.startsWith('New ') ? 'Create Node' : 'Edit Node';
    $('fName').value = node.name; $('fType').value = node.type; $('fDesc').value = node.desc || '';
    $('fBtnDel').style.display = node.name.startsWith('New ') ? 'none' : 'flex';
    renderTagChips(); renderSwatches();
    $('nodeModal').classList.add('on');
    setTimeout(() => $('fName').select(), 55);
    $('nodeModal').addEventListener('keydown', trapModal);
}
function closeModal() {
    $('nodeModal').classList.remove('on');
    $('nodeModal').removeEventListener('keydown', trapModal);
    S.editNode = null; mRF?.focus();
}
function trapModal(e) {
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key !== 'Tab') return;
    const fa = [...$('nodeModal').querySelectorAll('button:not([disabled]),input,select,textarea,[tabindex="0"]')].filter(el => !el.closest('[style*="display:none"]'));
    if (!fa.length) return;
    const f = fa[0], l = fa[fa.length - 1];
    if (e.shiftKey) { if (document.activeElement === f) { e.preventDefault(); l.focus(); } }
    else { if (document.activeElement === l) { e.preventDefault(); f.focus(); } }
}
$('nodeModal').addEventListener('click', e => { if (e.target === $('nodeModal')) closeModal(); });
$('mClose').addEventListener('click', closeModal); $('fBtnCancel').addEventListener('click', closeModal);
$('fBtnSave').addEventListener('click', () => {
    const n = S.editNode; if (!n) return;
    const v = $('fName').value.trim();
    if (!v) { $('fName').focus(); $('fName').setAttribute('aria-invalid', 'true'); return; }
    $('fName').removeAttribute('aria-invalid');
    n.name = v; n.type = $('fType').value; n.desc = $('fDesc').value; n.tags = [...S.editTags]; n.color = S.editColor;
    mountNode(n); refreshList(); renderLinks(); closeModal(); autoSave(); say(`Saved ${n.name}.`);
});
$('fName').addEventListener('keydown', e => { if (e.key === 'Enter') $('fBtnSave').click(); });
$('fBtnDel').addEventListener('click', () => {
    if (!S.editNode) return;
    if (!confirm(`Delete "${S.editNode.name}"?`)) return;
    delNode(S.editNode.id); closeModal(); autoSave();
});

/* Tag chips + input */
function renderTagChips() {
    const box = $('fTagsBox'); box.innerHTML = '';
    S.editTags.forEach(tag => {
        const chip = document.createElement('span'); chip.className = 'chip';
        const btn = document.createElement('button'); btn.className = 'chipx'; btn.type = 'button';
        btn.setAttribute('aria-label', `Remove tag ${tag}`); btn.textContent = '×';
        btn.addEventListener('click', () => { S.editTags = S.editTags.filter(t => t !== tag); renderTagChips(); });
        chip.appendChild(document.createTextNode(tag)); chip.appendChild(btn); box.appendChild(chip);
    });
    const inp = document.createElement('input'); inp.className = 'taginline';
    inp.placeholder = S.editTags.length ? '' : 'Add tag, Enter…'; inp.setAttribute('aria-label', 'Add tag');
    inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); const v = inp.value.trim(); if (v && !S.editTags.includes(v)) { S.editTags.push(v); renderTagChips(); } else inp.value = ''; }
        if (e.key === 'Backspace' && !inp.value && S.editTags.length) { S.editTags.pop(); renderTagChips(); }
    });
    box.appendChild(inp); box.addEventListener('click', () => inp.focus());
}

/* Swatches rendering */
function renderSwatches() {
    const box = $('fSwatches'); box.innerHTML = '';
    const seen = new Set();
    [...TYPES.map(t => t.color), ...PALETTE].forEach(c => {
        if (seen.has(c)) return; seen.add(c);
        const s = document.createElement('div'); s.className = 'swatch' + (S.editColor === c ? ' on' : '');
        s.style.background = c; s.setAttribute('role', 'radio');
        s.setAttribute('aria-checked', S.editColor === c ? 'true' : 'false');
        s.setAttribute('aria-label', 'Color ' + c); s.setAttribute('tabindex', S.editColor === c ? '0' : '-1');
        s.addEventListener('click', () => {
            S.editColor = c;
            box.querySelectorAll('.swatch').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); x.setAttribute('tabindex', '-1'); });
            s.classList.add('on'); s.setAttribute('aria-checked', 'true'); s.setAttribute('tabindex', '0');
        });
        s.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); s.click(); } });
        box.appendChild(s);
    });
}

/* ── OPTIONS ── */
let oRF = null;
function openOpts() { oRF = document.activeElement; $('optOv').classList.add('on'); $('optClose').focus(); $('optOv').addEventListener('keydown', trapOpts); }
function closeOpts() { $('optOv').classList.remove('on'); $('optOv').removeEventListener('keydown', trapOpts); oRF?.focus(); }
function trapOpts(e) {
    if (e.key === 'Escape') { closeOpts(); return; }
    if (e.key !== 'Tab') return;
    const all = [...$('optOv').querySelectorAll('button:not([disabled]),input,[tabindex="0"]')];
    const f = all[0], l = all[all.length - 1];
    if (e.shiftKey) { if (document.activeElement === f) { e.preventDefault(); l.focus(); } }
    else { if (document.activeElement === l) { e.preventDefault(); f.focus(); } }
}
$('btnOptions').addEventListener('click', openOpts);
$('optClose').addEventListener('click', closeOpts);
$('optOv').addEventListener('click', e => { if (e.target === $('optOv')) closeOpts(); });

document.querySelectorAll('.tpill').forEach(btn => {
    btn.addEventListener('click', () => {
        document.documentElement.setAttribute('data-theme', btn.dataset.theme);
        S.opts.theme = btn.dataset.theme;
        document.querySelectorAll('.tpill').forEach(b => { b.classList.toggle('on', b === btn); b.setAttribute('aria-checked', b === btn ? 'true' : 'false'); });
        applyCamera(); renderLinks(); autoSave(); say(`Theme: ${btn.textContent.trim()}`);
    });
});
document.querySelectorAll('.seg-b[data-scale]').forEach(btn => {
    btn.addEventListener('click', () => {
        const sc = btn.dataset.scale;
        document.documentElement.setAttribute('data-fontscale', sc === 'normal' ? '' : sc);
        S.opts.scale = sc;
        document.querySelectorAll('.seg-b[data-scale]').forEach(b => { b.classList.toggle('on', b === btn); b.setAttribute('aria-checked', b === btn ? 'true' : 'false'); });
        autoSave();
    });
});
$('optGrid').addEventListener('change', e => {
    S.opts.grid = e.target.checked;
    canv.style.backgroundImage = S.opts.grid ? 'linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px)' : 'none';
    if (S.opts.grid) applyCamera(); autoSave(); say(`Grid ${S.opts.grid ? 'on' : 'off'}`);
});
$('optMotion').addEventListener('change', e => {
    S.opts.motion = e.target.checked;
    document.documentElement.setAttribute('data-rm', S.opts.motion ? '1' : '0');
    autoSave(); say(`Reduced motion ${S.opts.motion ? 'on' : 'off'}`);
});
$('optFocus').addEventListener('change', e => {
    S.opts.focus = e.target.checked;
    document.documentElement.setAttribute('data-enhanced-focus', S.opts.focus ? '1' : '0');
    autoSave();
});
$('optCC').addEventListener('change', e => { S.opts.cc = e.target.checked; S.nodes.forEach(n => mountNode(n)); autoSave(); say(`Link counts ${S.opts.cc ? 'shown' : 'hidden'}`); });
$('optTags').addEventListener('change', e => { S.opts.tags = e.target.checked; S.nodes.forEach(n => mountNode(n)); autoSave(); say(`Node tags ${S.opts.tags ? 'shown' : 'hidden'}`); });
$('oExport').addEventListener('click', exportJSON);
$('oImport').addEventListener('click', () => $('fileInput').click());
$('oClear').addEventListener('click', () => { closeOpts(); $('btnClear').click(); });

/* ── DATA ── */
function autoSave() {
    try {
        localStorage.setItem('nexus-v3', JSON.stringify({ worldName: $('worldName').value, nodes: S.nodes, links: S.links, cam: S.cam, opts: S.opts }));
    } catch (e) { /* ignore */ }

    // if we're collaborating, send the updated state to connected peers
    if (S.collab && S.collab.connections.size > 0) {
        broadcastStateToPeers();
    }
}
function exportJSON() {
    const name = $('worldName').value || 'nexus-world';
    const blob = new Blob([JSON.stringify({ worldName: name, nodes: S.nodes, links: S.links }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name.replace(/\s+/g, '-') + '.json'; a.click(); URL.revokeObjectURL(a.href);
    say('World exported.');
}
function applyOpts(o) {
    document.documentElement.setAttribute('data-theme', o.theme || 'light');
    document.documentElement.setAttribute('data-fontscale', o.scale === 'normal' || !o.scale ? '' : o.scale);
    document.documentElement.setAttribute('data-rm', o.motion ? '1' : '0');
    document.documentElement.setAttribute('data-enhanced-focus', o.focus ? '1' : '0');
    $('optGrid').checked = o.grid !== false; $('optMotion').checked = !!o.motion;
    $('optFocus').checked = !!o.focus; $('optCC').checked = o.cc !== false; $('optTags').checked = o.tags !== false;
    if (!o.grid) canv.style.backgroundImage = 'none';
    document.querySelectorAll('.tpill').forEach(b => { b.classList.toggle('on', b.dataset.theme === (o.theme || 'light')); b.setAttribute('aria-checked', b.dataset.theme === (o.theme || 'light') ? 'true' : 'false'); });
    const sc = o.scale || 'normal';
    document.querySelectorAll('.seg-b[data-scale]').forEach(b => { b.classList.toggle('on', b.dataset.scale === sc); b.setAttribute('aria-checked', b.dataset.scale === sc ? 'true' : 'false'); });
}

function loadData(data) {
    $('worldName').value = data.worldName || 'New World';
    S.nodes = []; S.links = [];
    $('world').querySelectorAll('.node').forEach(n => n.remove());
    S.nodes = data.nodes || [];
    S.links = (data.links || []).map(l => ({ ...l, id: l.id || uid() }));
    if (data.cam) S.cam = { ...S.cam, ...data.cam };
    if (data.opts) { Object.assign(S.opts, data.opts); applyOpts(S.opts); }
    S.nodes.forEach(n => mountNode(n));
    renderLinks(); refreshList(); applyCamera(); updateEmpty();
}
$('btnExport').addEventListener('click', exportJSON);
$('btnImport').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => { try { loadData(JSON.parse(ev.target.result)); autoSave(); say('World imported.'); } catch { alert('Invalid file.'); } };
    r.readAsText(f); e.target.value = '';
});
$('btnClear').addEventListener('click', () => {
    if (!confirm('Clear all nodes and connections?')) return;
    S.nodes = []; S.links = []; S.selNode = null; S.selLink = null; S.kbIdx = -1;
    $('world').querySelectorAll('.node').forEach(n => n.remove());
    renderLinks(); refreshList(); updateEmpty(); autoSave(); say('Canvas cleared.');
});
$('worldName').addEventListener('input', autoSave);

/* ── MISC ── */
function updateEmpty() { $('emptySt').classList.toggle('gone', S.nodes.length > 0); }

/* respect system prefers-reduced-motion */
if (window.matchMedia('(prefers-reduced-motion:reduce)').matches && !S.opts.motion) {
    S.opts.motion = true; $('optMotion').checked = true;
    document.documentElement.setAttribute('data-rm', '1');
}

/* ── COLLABORATION ── */
function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

function createRoom() {
    S.collab.roomCode = generateRoomCode();
    S.collab.isHost = true;

    S.collab.peer = new Peer('nexus-' + S.collab.roomCode, {
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });

    S.collab.peer.on('open', (id) => {
        console.log('Peer initialized with ID:', id);
        updateConnectionStatus('online', `Room created: ${S.collab.roomCode}`);
        updateRoomCodeDisplay();
        const newUrl = window.location.origin + window.location.pathname + '?room=' + S.collab.roomCode;
        window.history.pushState({}, '', newUrl);
    });

    S.collab.peer.on('connection', (conn) => {
        handleConnection(conn);
    });

    S.collab.peer.on('error', (err) => {
        console.error('Peer error:', err);
        updateConnectionStatus('offline', 'Connection error');
    });
}

function joinRoom(roomCode) {
    S.collab.roomCode = roomCode;
    S.collab.isHost = false;

    S.collab.peer = new Peer({
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });

    S.collab.peer.on('open', (id) => {
        console.log('Peer initialized, joining room:', roomCode);
        const conn = S.collab.peer.connect('nexus-' + roomCode, { reliable: true });
        handleConnection(conn);
        updateRoomCodeDisplay();
    });

    S.collab.peer.on('connection', (conn) => {
        handleConnection(conn);
    });

    S.collab.peer.on('error', (err) => {
        console.error('Peer error:', err);
        updateConnectionStatus('offline', 'Failed to join room');
    });
}

function handleConnection(conn) {
    conn.on('open', () => {
        console.log('Connected to peer:', conn.peer);
        S.collab.connections.set(conn.peer, conn);
        const peerCount = S.collab.connections.size;
        updateConnectionStatus('online', `Connected (${peerCount + 1} users)`);
        if (S.collab.isHost) {
            conn.send({
                type: 'full_state',
                data: {
                    worldName: $('worldName').value,
                    nodes: S.nodes,
                    links: S.links
                }
            });
        }
    });
    conn.on('data', (data) => {
        handlePeerData(data, conn);
    });
    conn.on('close', () => {
        S.collab.connections.delete(conn.peer);
        const peerCount = S.collab.connections.size;
        updateConnectionStatus('online', `Connected (${peerCount + 1} users)`);
    });
}

function handlePeerData(data, conn) {
    if (data.type === 'full_state' || data.type === 'state_update') {
        const d = data.data;
        if (d.worldName !== undefined) $('worldName').value = d.worldName;
        S.nodes = d.nodes || [];
        S.links = d.links || [];
        $('world').querySelectorAll('.node').forEach(n => n.remove());
        S.nodes.forEach(n => mountNode(n));
        renderLinks(); refreshList(); updateEmpty();
    } else if (data.type === 'cursor') {
        updateCollaboratorCursor(data.id, data.color, data.x, data.y);
    }
}

function broadcastStateToPeers() {
    const payload = {
        type: 'state_update',
        data: {
            worldName: $('worldName').value,
            nodes: S.nodes,
            links: S.links
        }
    };
    S.collab.connections.forEach(conn => { if (conn.open) conn.send(payload); });
}

function broadcastCursorToPeers(x, y) {
    const payload = { type: 'cursor', id: S.collab.myId, color: S.collab.myColor, x, y };
    S.collab.connections.forEach(conn => { if (conn.open) conn.send(payload); });
}

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}

function updateConnectionStatus(status, message) {
    console.log('connectionStatus', status, message);
}

function updateRoomCodeDisplay() {
    /* no UI element by default */
}

function updateCollaboratorsList() {
    const list = $('collaboratorsList'); if (!list) return;
    list.innerHTML = '';
    S.collab.collaborators.forEach((c, id) => {
        const item = document.createElement('div');
        item.textContent = `User ${id.substring(0,4)}`;
        item.style.color = c.color;
        list.appendChild(item);
    });
}

function updateCollaboratorCursor(id, color, x, y) {
    let cursor = document.getElementById(`cursor-${id}`);
    if (!cursor) {
        cursor = document.createElement('div');
        cursor.id = `cursor-${id}`;
        cursor.className = 'collab-cursor';
        cursor.innerHTML = `<div class="collab-cursor-name" style="color: ${color};">User ${id.substring(0,4)}</div>`;
        document.getElementById('canvas').appendChild(cursor);
    }
    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';
    const c = S.collab.collaborators.get(id);
    if (c) c.lastSeen = Date.now();
    else {
        S.collab.collaborators.set(id, { color, lastSeen: Date.now() });
        updateCollaboratorsList();
    }
}

setInterval(() => {
    const now = Date.now();
    S.collab.collaborators.forEach((c,id) => {
        if (now - c.lastSeen > 5000) {
            S.collab.collaborators.delete(id);
            const cur = document.getElementById(`cursor-${id}`);
            if (cur) cur.remove();
            updateCollaboratorsList();
        }
    });
}, 2000);

// share panel event listeners
$('btnShare').addEventListener('click', () => {
    const panel = $('sharePanel');
    panel.classList.add('active');
    if (!S.collab.roomCode) createRoom();
    const url = window.location.origin + window.location.pathname + '?room=' + S.collab.roomCode;
    $('shareUrl').textContent = url;
    updateCollaboratorsList();
});
$('closeShareBtn').addEventListener('click', () => $('sharePanel').classList.remove('active'));
$('copyUrlBtn').addEventListener('click', () => {
    const url = $('shareUrl').textContent;
    navigator.clipboard.writeText(url).then(() => {
        const btn = $('copyUrlBtn');
        const orig = btn.innerHTML;
        btn.innerHTML = '<span>Copied!</span>';
        setTimeout(() => btn.innerHTML = orig, 2000);
    });
});

// cursor broadcasting
document.addEventListener('mousemove', e => {
    if (S.collab && S.collab.connections.size) {
        const r = canv.getBoundingClientRect();
        broadcastCursorToPeers(e.clientX - r.left, e.clientY - r.top);
    }
});

// join room from URL param
const urlRoom = getQueryParam('room');
if (urlRoom) joinRoom(urlRoom);

/* ── INIT ── */
initSidebar(); setTool('select');
const saved = localStorage.getItem('nexus-v3');
if (saved) { try { loadData(JSON.parse(saved)); } catch (e) { applyCamera(); applyOpts(S.opts); } }
else { applyCamera(); applyOpts(S.opts); }
updateEmpty(); canv.focus();