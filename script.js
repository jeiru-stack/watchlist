// script.js
// App logic for "May & Jay". Expects seedItems and defaultCategoryOrder
// to already be defined (see data.js, loaded before this file).

const PLACEHOLDER_POSTER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="100%" height="100%" fill="#262030"/><text x="50%" y="50%" fill="#a89d9a" font-family="sans-serif" font-size="18" text-anchor="middle" dominant-baseline="middle">No image</text></svg>');
const PLACEHOLDER_BANNER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="100%" height="100%" fill="#1c1922"/><text x="50%" y="50%" fill="#a89d9a" font-family="sans-serif" font-size="22" text-anchor="middle" dominant-baseline="middle">No image</text></svg>');

const STORAGE_KEY = 'library:items';

let categoryOrder = defaultCategoryOrder.slice();
let items = [];
let currentFilter = 'all';
let currentModalItem = null;
let mobileMenuOpen = false;
let surpriseTimer = null;
let heroCycleTimer = null;
let doubleFiveIndex = 0;
let currentHeroItemId = null;

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, function(ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
}

function getAverageRating(item) {
    const allRatings = [];
    if (item.watched) {
        if (item.watched.may) allRatings.push(item.watched.may.rating);
        if (item.watched.jay) allRatings.push(item.watched.jay.rating);
    }
    if (allRatings.length > 0) {
        const avg = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;
        return Math.round(avg * 2) / 2;
    }
    return 0;
}

function ratingToStars(rating) {
    const full = Math.floor(rating);
    const half = (rating % 1 >= 0.5) ? 1 : 0;
    const empty = 5 - full - half;
    return '★'.repeat(full) + (half ? '½' : '') + (empty > 0 ? '☆'.repeat(empty) : '');
}

function formatPlannedDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((d - today) / 86400000);
    const dateStr = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    if (diffDays === 0) return 'Today \u00b7 ' + dateStr;
    if (diffDays === 1) return 'Tomorrow \u00b7 ' + dateStr;
    if (diffDays > 1 && diffDays <= 7) return 'In ' + diffDays + ' days \u00b7 ' + dateStr;
    if (diffDays < 0) return dateStr + ' (past)';
    return dateStr;
}

function getDoubleFiveItems() {
    return items.filter(i =>
        i.watched &&
        i.watched.may &&
        i.watched.jay &&
        i.watched.may.rating === 5 &&
        i.watched.jay.rating === 5
    );
}

async function loadItems() {
    try {
        if (window.storage) {
            const result = await window.storage.get(STORAGE_KEY, true);
            if (result && result.value) {
                items = JSON.parse(result.value);
                return;
            }
        }
    } catch (e) {
        console.warn('No saved library found, using hardcoded defaults.', e);
    }
    items = seedItems.map(i => Object.assign({}, i));
    await persistItems();
}

async function persistItems() {
    try {
        if (window.storage) {
            await window.storage.set(STORAGE_KEY, JSON.stringify(items), true);
        }
    } catch (e) {
        console.error('Could not save library changes.', e);
    }
}

function ensureAllCategories() {
    items.forEach(i => { if (!categoryOrder.includes(i.category)) categoryOrder.push(i.category); });
}

function pickHeroItem() {
    const upcoming = items.filter(i => !i.watched && i.plannedDate)
        .sort((a, b) => new Date(a.plannedDate) - new Date(b.plannedDate));
    if (upcoming.length) return { item: upcoming[0], reason: 'scheduled' };
    const watchedItems = items.filter(i => i.watched);
    if (watchedItems.length) {
        const best = watchedItems.slice().sort((a, b) => getAverageRating(b) - getAverageRating(a))[0];
        return { item: best, reason: 'favorite' };
    }
    if (items.length) return { item: items[0], reason: 'default' };
    return { item: null, reason: 'none' };
}

function refreshHero(forcedItem) {
    let item, reason;
    if (forcedItem) {
        item = forcedItem;
        reason = 'doubleFive';
    } else {
        const result = pickHeroItem();
        item = result.item;
        reason = result.reason;
    }

    if (!item) {
        currentHeroItemId = null;
        document.getElementById('heroEyebrow').textContent = 'YOUR LIBRARY';
        document.getElementById('heroTitle').textContent = 'Nothing here yet';
        document.getElementById('heroStars').textContent = '';
        document.getElementById('heroYear').textContent = '';
        document.getElementById('heroDuration').textContent = '';
        document.getElementById('heroDescription').textContent = 'Add your first title to get started.';
        document.getElementById('hero').style.backgroundImage = '';
        return;
    }
    currentHeroItemId = item.id;
    const avg = getAverageRating(item);
    const eyebrow = document.getElementById('heroEyebrow');
    if (reason === 'doubleFive') {
        eyebrow.textContent = 'MAY & JAY · BOTH 5/5';
    } else if (reason === 'scheduled') {
        eyebrow.textContent = 'NEXT MOVIE NIGHT · ' + formatPlannedDate(item.plannedDate).toUpperCase();
    } else if (reason === 'favorite') {
        eyebrow.textContent = 'AN OLD FAVORITE OF OURS';
    } else {
        eyebrow.textContent = 'FROM THE LIBRARY';
    }
    document.getElementById('heroTitle').textContent = item.title;
    document.getElementById('heroStars').textContent = ratingToStars(avg) || '☆☆☆☆☆';
    document.getElementById('heroYear').textContent = item.year;
    document.getElementById('heroDuration').textContent = item.duration;
    document.getElementById('heroDescription').textContent = item.description;
    const banner = item.banner || item.poster || '';
    document.getElementById('hero').style.backgroundImage =
        "linear-gradient(180deg, rgba(20,17,26,0) 0%, rgba(20,17,26,0.35) 38%, rgba(20,17,26,0.86) 72%, #14111a 100%), " +
        "linear-gradient(90deg, rgba(20,17,26,0.7) 0%, rgba(20,17,26,0.2) 50%, rgba(20,17,26,0.05) 100%), " +
        "url('" + banner.replace(/'/g, "%27") + "')";
    const heroContent = document.getElementById('heroContent');
    heroContent.style.animation = 'none';
    void heroContent.offsetHeight;
    heroContent.style.animation = 'fadeInUp 0.7s ease forwards';
}

function startHeroCycling() {
    if (heroCycleTimer) clearInterval(heroCycleTimer);
    heroCycleTimer = setInterval(() => {
        const doubleFive = getDoubleFiveItems();
        if (doubleFive.length === 0) {
            refreshHero();
            return;
        }
        doubleFiveIndex = (doubleFiveIndex + 1) % doubleFive.length;
        refreshHero(doubleFive[doubleFiveIndex]);
    }, 10000);
}

async function init() {
    await loadItems();
    ensureAllCategories();
    refreshHero();
    startHeroCycling();
    renderAllCategories();

    document.getElementById('heroDetailsBtn').addEventListener('click', () => {
        if (currentHeroItemId !== null) openDetail(currentHeroItemId);
    });
    document.getElementById('heroSurpriseBtn').addEventListener('click', surprisePick);

    window.addEventListener('scroll', () => {
        document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 40);
    });
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && mobileMenuOpen) closeMobileMenu();
    });
}

function toggleMobileMenu() {
    const hamburger = document.getElementById('hamburger');
    const overlay = document.getElementById('mobileNavOverlay');
    mobileMenuOpen = !mobileMenuOpen;
    if (mobileMenuOpen) {
        hamburger.classList.add('open');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    } else {
        closeMobileMenu();
    }
}
function closeMobileMenu() {
    mobileMenuOpen = false;
    document.getElementById('hamburger').classList.remove('open');
    document.getElementById('mobileNavOverlay').classList.remove('active');
    document.body.style.overflow = '';
}
function mobileNavSelect(filter, linkElement) {
    closeMobileMenu();
    filterContent(filter, null);
    document.querySelectorAll('#mobileNavOverlay a').forEach(a => a.classList.remove('active-mob'));
    if (linkElement) linkElement.classList.add('active-mob');
    document.querySelectorAll('.nav-links li a').forEach(a => {
        a.classList.remove('active');
        if (a.getAttribute('data-filter') === filter) a.classList.add('active');
    });
}
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('mobileNavOverlay');
    if (overlay) overlay.addEventListener('click', function(e) { if (e.target === this) closeMobileMenu(); });
});

function createCardHTML(item, showBadge) {
    const avg = getAverageRating(item);
    const stars = ratingToStars(avg);
    const typeLabel = item.type === 'movie' ? 'Movie' : 'Series';
    let badge = '';
    if (showBadge && item.plannedDate) badge = '<span class="schedule-badge">📅 ' + escapeHtml(formatPlannedDate(item.plannedDate)) + '</span>';
    let miniRatings = '';
    if (item.watched) {
        const mayR = item.watched.may ? item.watched.may.rating.toFixed(1) : '–';
        const jayR = item.watched.jay ? item.watched.jay.rating.toFixed(1) : '–';
        miniRatings = '<div class="mini-ratings"><span class="mini-may">M ' + mayR + '</span><span class="mini-jay">J ' + jayR + '</span></div>';
    }
    return '' +
        '<div class="card" data-id="' + item.id + '">' +
        '<div class="card-poster-wrapper"><img class="card-poster" src="' + escapeHtml(item.poster) + '" alt="' + escapeHtml(item.title) + '" loading="lazy" onerror="this.onerror=null;this.src=PLACEHOLDER_POSTER;"></div>' +
        '<span class="card-type-badge">' + typeLabel + '</span>' +
        '<div class="card-info">' +
        '<div class="card-title">' + escapeHtml(item.title) + '</div>' +
        '<div class="card-stars">' + (stars || '☆☆☆☆☆') + '</div>' +
        miniRatings +
        '<div class="card-meta"><span>' + item.year + '</span>' + badge + '</div>' +
        '</div>' +
        '</div>';
}

function renderCategoryHTML(categoryName, list, showBadge) {
    const cards = list.map(item => createCardHTML(item, showBadge)).join('');
    return '<div class="category-section"><div class="category-header"><span class="category-title">' + escapeHtml(categoryName) + '</span></div><div class="category-row">' + cards + '</div></div>';
}

function emptyState(title, sub) {
    return '<div class="empty-state"><h2>' + escapeHtml(title) + '</h2><p>' + escapeHtml(sub) + '</p></div>';
}

function groupByCategory(list, showBadge) {
    const grouped = {};
    list.forEach(i => { if (!grouped[i.category]) grouped[i.category] = []; grouped[i.category].push(i); });
    let html = '';
    const seen = new Set();
    categoryOrder.forEach(cat => {
        if (grouped[cat] && grouped[cat].length) { html += renderCategoryHTML(cat, grouped[cat], showBadge);
            seen.add(cat); }
    });
    Object.keys(grouped).forEach(cat => {
        if (!seen.has(cat) && grouped[cat].length) html += renderCategoryHTML(cat, grouped[cat], showBadge);
    });
    return html;
}

function renderWatchlistHTML(list) {
    const unwatched = list.filter(i => !i.watched);
    const scheduled = unwatched.filter(i => i.plannedDate).sort((a, b) => new Date(a.plannedDate) - new Date(b.plannedDate));
    const someday = unwatched.filter(i => !i.plannedDate);
    let html = '';
    if (scheduled.length) html += renderCategoryHTML('Coming Up', scheduled, true);
    if (someday.length) html += renderCategoryHTML('Someday', someday, false);
    return html || emptyState('Nothing on the watchlist yet', 'Open any title and set a planned date, or add something new.');
}

function renderAllCategories() {
    const container = document.getElementById('mainContent');
    if (currentFilter === 'watchlist') {
        container.innerHTML = renderWatchlistHTML(items);
        return;
    }
    if (currentFilter === 'alreadyWatched') {
        const watchedItems = items.filter(i => i.watched);
        container.innerHTML = groupByCategory(watchedItems, false) || emptyState('No watched titles yet', "Open a title and log a rating once you've watched it together.");
        return;
    }
    const filtered = items.filter(i => currentFilter === 'all' || i.type === currentFilter);
    container.innerHTML = groupByCategory(filtered, false) || emptyState('Nothing here yet', 'Try a different filter, or add something new.');
}

function filterContent(filter, linkElement) {
    currentFilter = filter;
    document.querySelectorAll('.nav-links li a').forEach(a => a.classList.remove('active'));
    if (linkElement) linkElement.classList.add('active');
    document.querySelectorAll('#mobileNavOverlay a').forEach(a => {
        a.classList.remove('active-mob');
        if (a.getAttribute('data-filter') === filter) a.classList.add('active-mob');
    });
    document.getElementById('searchInput').value = '';
    renderAllCategories();
    document.getElementById('mainContent').scrollIntoView({ behavior: 'smooth', block: 'start' });
    closeMobileMenu();
}

function handleSearch() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    if (!query) { renderAllCategories(); return; }
    let filtered = items.filter(i => i.title.toLowerCase().includes(query));
    if (currentFilter === 'movie' || currentFilter === 'series') filtered = filtered.filter(i => i.type === currentFilter);
    else if (currentFilter === 'alreadyWatched') filtered = filtered.filter(i => i.watched);
    else if (currentFilter === 'watchlist') filtered = filtered.filter(i => !i.watched);
    const container = document.getElementById('mainContent');
    if (!filtered.length) { container.innerHTML = emptyState('No results', 'Nothing matches "' + document.getElementById('searchInput').value.trim() + '".'); return; }
    if (currentFilter === 'watchlist') container.innerHTML = renderWatchlistHTML(filtered);
    else container.innerHTML = renderCategoryHTML('Search Results', filtered, false);
}

document.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (card && document.getElementById('mainContent').contains(card)) {
        openDetail(Number(card.dataset.id));
    }
});

function buildSyncMeterHTML(mayRating, jayRating) {
    const delta = Math.abs(mayRating - jayRating);
    let caption;
    if (delta === 0) caption = 'Perfectly in sync 🎯';
    else if (delta <= 0.5) caption = 'Practically twins 🤝';
    else if (delta <= 1.5) caption = 'A little different taste 🎬';
    else caption = 'Totally different wavelengths 📡';
    const mayPos = (mayRating / 5 * 100).toFixed(1);
    const jayPos = (jayRating / 5 * 100).toFixed(1);
    return '' +
        '<div class="sync-meter">' +
        '<div class="sync-track"><span class="sync-dot sync-may" style="left:' + mayPos + '%"></span><span class="sync-dot sync-jay" style="left:' + jayPos + '%"></span></div>' +
        '<div class="sync-caption">' + caption + '</div>' +
        '</div>';
}

function buildModalBodyHTML(item) {
    const avg = getAverageRating(item);
    const typeLabel = item.type === 'movie' ? 'Movie' : 'Series';
    let sync = '';
    let existingRatingsHtml = '';
    if (item.watched) {
        if (item.watched.may && item.watched.jay) {
            sync = buildSyncMeterHTML(item.watched.may.rating, item.watched.jay.rating);
        }
        existingRatingsHtml = '<div class="existing-ratings">';
        if (item.watched.may) {
            existingRatingsHtml += '<div class="note-card note-may"><div class="note-card-head">May ★ ' + item.watched.may.rating.toFixed(1) + '</div>';
            if (item.watched.may.comment) existingRatingsHtml += '<p>' + escapeHtml(item.watched.may.comment) + '</p>';
            existingRatingsHtml += '</div>';
        }
        if (item.watched.jay) {
            existingRatingsHtml += '<div class="note-card note-jay"><div class="note-card-head">Jay ★ ' + item.watched.jay.rating.toFixed(1) + '</div>';
            if (item.watched.jay.comment) existingRatingsHtml += '<p>' + escapeHtml(item.watched.jay.comment) + '</p>';
            existingRatingsHtml += '</div>';
        }
        existingRatingsHtml += '</div>';
    }
    let plannedDateHtml = '';
    if (item.plannedDate) {
        plannedDateHtml = '<div class="planned-date-display">📅 ' + escapeHtml(formatPlannedDate(item.plannedDate)) + '</div>';
    }
    return '' +
        '<h2 class="modal-title">' + escapeHtml(item.title) + '</h2>' +
        '<div class="modal-meta">' +
        '<span class="modal-stars">' + (ratingToStars(avg) || '☆☆☆☆☆') + '</span>' +
        '<span>' + item.year + '</span><span>' + escapeHtml(item.duration) + '</span><span>' + typeLabel + '</span>' +
        '</div>' +
        '<p class="modal-description">' + escapeHtml(item.description) + '</p>' +
        '<div id="syncMeterSlot">' + sync + '</div>' +
        existingRatingsHtml +
        plannedDateHtml;
}

function openDetail(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    currentModalItem = item;
    document.getElementById('modalPoster').src = item.banner || item.poster || PLACEHOLDER_BANNER;
    document.getElementById('modalPoster').alt = item.title;
    document.getElementById('modalBody').innerHTML = buildModalBodyHTML(item);
    const overlay = document.getElementById('modalOverlay');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    document.getElementById('modal').scrollTop = 0;
}

function closeModal(e) {
    if (e && e.target !== document.getElementById('modalOverlay')) return;
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
    currentModalItem = null;
}

function surprisePick() {
    let pool = items.filter(i => !i.watched);
    let usingFallback = false;
    if (!pool.length) { pool = items.slice();
        usingFallback = true; }
    if (!pool.length) return;

    const finalItem = pool[Math.floor(Math.random() * pool.length)];
    const overlay = document.getElementById('surpriseOverlay');
    const img = document.getElementById('surpriseImg');
    const text = document.getElementById('surpriseText');
    const sub = document.getElementById('surpriseSub');
    text.textContent = 'Picking something for tonight…';
    sub.textContent = 'Hold tight';
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    let ticks = 0;
    const maxTicks = 14;
    if (surpriseTimer) clearInterval(surpriseTimer);
    surpriseTimer = setInterval(() => {
        ticks++;
        const randomItem = pool[Math.floor(Math.random() * pool.length)];
        img.src = randomItem.poster || PLACEHOLDER_POSTER;
        if (ticks >= maxTicks) {
            clearInterval(surpriseTimer);
            img.src = finalItem.poster || PLACEHOLDER_POSTER;
            text.textContent = finalItem.title;
            sub.textContent = usingFallback ? 'You’ve seen it all — here’s an old favorite' : 'Tonight’s pick';
            setTimeout(() => {
                overlay.classList.remove('active');
                document.body.style.overflow = '';
                openDetail(finalItem.id);
            }, 900);
        }
    }, 90);
}

function closeSurprise(e) {
    if (e && e.target !== document.getElementById('surpriseOverlay')) return;
    if (surpriseTimer) clearInterval(surpriseTimer);
    document.getElementById('surpriseOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        if (document.getElementById('modalOverlay').classList.contains('active')) closeModal();
        else if (document.getElementById('surpriseOverlay').classList.contains('active')) closeSurprise({ target: document.getElementById('surpriseOverlay') });
        else if (mobileMenuOpen) closeMobileMenu();
    }
    if ((e.key === '/' || (e.ctrlKey && e.key === 'f')) && document.activeElement !== document.getElementById('searchInput')) {
        e.preventDefault();
        document.getElementById('searchInput').focus();
    }
});

init();
