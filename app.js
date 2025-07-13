const TMDB_API_KEY = '4130de3474cebb9a3f97764b7e97d943';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';
const ORIGINAL_IMG = 'https://image.tmdb.org/t/p/original';

const IMG_BASE_W342 = 'https://image.tmdb.org/t/p/w342';
const IMG_BASE_W500 = 'https://image.tmdb.org/t/p/w500';
const IMG_BASE_W780 = 'https://image.tmdb.org/t/p/w780';
const IMG_BASE_ORIGINAL = 'https://image.tmdb.org/t/p/original';

const heroTitle = document.getElementById('hero-title');
const heroOverview = document.getElementById('hero-overview');
const heroMeta = document.getElementById('hero-meta');
const searchCarousel = document.getElementById('search-carousel');
const navbar = document.getElementById('navbar');
let heroItems = [], currentHeroIndex = 0, heroTimer = null;
let ytPlayer = null;
let trailerTimer = null;

const carousels = {
  'trending-carousel': { url: `${TMDB_BASE}/trending/movie/week?api_key=${TMDB_API_KEY}`, type: 'movie' },
  'top-rated-carousel': { url: `${TMDB_BASE}/movie/top_rated?api_key=${TMDB_API_KEY}`, type: 'movie' },
  'action-carousel': { url: `${TMDB_BASE}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=28`, type: 'movie' },
  'scifi-carousel': { url: `${TMDB_BASE}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=878`, type: 'movie' },
  'horror-carousel': { url: `${TMDB_BASE}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=27`, type: 'movie' },
  'tv-carousel': { url: `${TMDB_BASE}/tv/popular?api_key=${TMDB_API_KEY}`, type: 'tv' }
}

// === Hero Navigation & Swipe Handling ===
window.addEventListener('DOMContentLoaded', () => {
  const heroSection = document.getElementById('hero');
  if (!heroSection) return;

  let startX = 0, endX = 0;
  let swipeLocked = false;

  // Touch swipe start
  heroSection.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
  });

  // Touch swipe end
  heroSection.addEventListener('touchend', (e) => {
    endX = e.changedTouches[0].clientX;
    handleHeroSwipe();
  });

  // Mouse or trackpad swipe (horizontal scroll)
  heroSection.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      if (e.deltaX > 20) nextHero();
      else if (e.deltaX < -20) prevHero();
    }
  }, { passive: false });

  // Keyboard arrow keys
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') prevHero();
    if (e.key === 'ArrowRight') nextHero();
  });

  // Swipe logic
  function handleHeroSwipe() {
    const diff = endX - startX;
    if (diff > 50) prevHero();      // Swipe right → go back
    else if (diff < -50) nextHero(); // Swipe left → go forward
  }

  // Show next hero item
  function nextHero() {
    if (swipeLocked) return;
    swipeLocked = true;
    showHero(currentHeroIndex + 1);
    setTimeout(() => swipeLocked = false, 600); // Lock to prevent double swipes
  }

  // Show previous hero item
  function prevHero() {
    if (swipeLocked) return;
    swipeLocked = true;
    showHero(currentHeroIndex - 1);
    setTimeout(() => swipeLocked = false, 600);
  }
});




async function loadTitleLogo(id) {
  if (logoCache[id]) return logoCache[id]; // Use cached result

  const url = `${TMDB_BASE}/movie/${id}/images?api_key=${TMDB_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const logo = data.logos.find(l => l.iso_639_1 === 'en');
  const logoUrl = logo ? `https://image.tmdb.org/t/p/original${logo.file_path}` : null;

  logoCache[id] = logoUrl; // Cache it
  return logoUrl;
}

function preloadHeroAssets() {
  for (let i = 1; i < heroItems.length; i++) {
    const item = heroItems[i];
    loadTitleLogo(item.id);
    const img = new Image();
    img.src = ORIGINAL_IMG + item.backdrop_path;
    backdropCache[item.id] = img.src;
  }
}


window.addEventListener("message", function (event) {
  let data;

  try {
    data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
  } catch (e) {
    console.warn('[VIDEASY] Invalid JSON:', event.data);
    return;
  }

  // VIDEASY now wraps data in { type: 'MEDIA_DATA', data: '{...}' }
  if (data?.type === 'MEDIA_DATA') {
    try {
      const inner = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;

      console.log('[VIDEASY] Progress received:', inner);

      if (!inner || !inner.id) return;

      let key = `videasy_progress_${inner.type}_${inner.id}`;
      if (inner.type === 'tv' || inner.type === 'anime') {
        key += `_s${inner.season}_e${inner.episode}`;
      }

      localStorage.setItem(key, JSON.stringify({
        progress: inner.progress,
        timestamp: inner.timestamp,
        duration: inner.duration,
        lastWatched: new Date().toISOString()
      }));

    } catch (err) {
      console.warn('[VIDEASY] Error parsing inner data:', data.data);
    }
  }
});


window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 100);
});

// === Hero ===
async function loadHero() {
  const res = await fetch(`${TMDB_BASE}/trending/movie/week?api_key=${TMDB_API_KEY}`);
  const data = await res.json();
  heroItems = data.results.slice(0, 20);
  showHero(0);
}

async function showHero(index) {
  currentHeroIndex = (index + heroItems.length) % heroItems.length;
  await setHero(heroItems[currentHeroIndex]);
}


function showNextHero() { showHero(currentHeroIndex + 1); }
function showPrevHero() { showHero(currentHeroIndex - 1); }

async function setHero(item) {
  const title = item.title || item.name;
  const overview = item.overview;
  const release = item.release_date || item.first_air_date;
  const year = release ? new Date(release).getFullYear() : '';
  const rating = item.vote_average?.toFixed(1) || 'N/A';
  const bgPath = item.backdrop_path || item.poster_path;
const bgURL = ORIGINAL_IMG + bgPath;
  const type = item.media_type || (item.first_air_date ? 'tv' : 'movie');

  const heroTitleImg = document.getElementById('hero-title-img');
const heroTitleText = document.getElementById('hero-title');

const logoUrl = await loadTitleLogo(item.id, type);
if (logoUrl) {
  heroTitleImg.src = logoUrl;
  heroTitleImg.loading = 'lazy';
  heroTitleImg.style.display = 'block';
  heroTitleText.style.display = 'none';
} else {
  heroTitleImg.style.display = 'none';
  heroTitleText.textContent = title;
  heroTitleText.style.display = 'block';
}

  heroOverview.textContent = overview;
  heroMeta.innerHTML = `
    <div class="meta-item">${rating}</div>
    <div class="meta-item">${year}</div>
    <div class="meta-item">${type === 'tv' ? 'TV Show' : 'Movie'}</div>
  `;

  const heroSection = document.getElementById('hero-section');
  if (heroSection && heroSection.style.backgroundImage !== `url("${bgURL}")`) {
    const preload = new Image();
    preload.src = bgURL;
    preload.onload = () => {
      heroSection.style.backgroundImage = `url('${bgURL}')`;
    };
  }
  
  const playBtn = document.getElementById('play-btn');
  playBtn.onclick = async () => {
    if (type === 'movie') {
      openViewingPage(item, 'movie');
    } else {
      // Get official TMDB ID first
      const officialId = await getOfficialTmdbId(item);
      if (officialId) {
        const newItem = {...item, id: officialId};
        openViewingPage(newItem, 'tv', 1, 1);
      } else {
        console.error('Could not find valid TMDB ID for this TV show');
      }
    }
  };

  const infoBtn = document.getElementById('info-btn');
  if (infoBtn) {
    infoBtn.onclick = () => {
      console.log(`[Modal] Opening: ${title} as ${type}`);
      openModal(item, type);
    };
  }
}


// Hero navigation
const heroNext = document.getElementById('hero-next');
const heroPrev = document.getElementById('hero-prev');
if (heroNext) heroNext.onclick = showNextHero;
if (heroPrev) heroPrev.onclick = showPrevHero;

// === Carousels ===
async function loadCarousel(id, config) {
  const res = await fetch(config.url);
  const data = await res.json();
  const container = document.getElementById(id);
  if (!container) return;

  container.innerHTML = '';

  for (const item of data.results.slice(0, 20)) {
    const title = item.title || item.name || 'Untitled';
    const basePath = item.backdrop_path || item.poster_path || '';
const smallImg = basePath ? `${IMG_BASE_W342}${basePath}` : '';
const mediumImg = basePath ? `${IMG_BASE_W500}${basePath}` : '';
const largeImg = basePath ? `${IMG_BASE_W780}${basePath}` : '';
    const rating = item.vote_average?.toFixed(1) || 'N/A';

    // 👇 Fetch the title logo if available
    const logoUrl = await loadTitleLogo(item.id, config.type);

    const card = document.createElement('div');
    card.className = 'movie-card';
    card.innerHTML = `
  <img 
    class="movie-poster lazyload" 
    src="${smallImg}" 
    srcset="${smallImg} 342w, ${mediumImg} 500w, ${largeImg} 780w" 
    sizes="(max-width: 600px) 342px, (max-width: 1200px) 500px, 780px" 
    alt="${title}" 
    loading="lazy" 
  />
  <div class="rating-badge">⭐ ${rating}</div>
  ${logoUrl
    ? `<img class="movie-logo lazyload" src="${logoUrl}" alt="${title} Logo" loading="lazy" />`
    : `<div class="movie-title">${title}</div>`
  }
`;

    card.onclick = () => {
      console.log(`[Carousel] Opening: ${title} as ${config.type}`);
      openModal(item, config.type);
    };

    container.appendChild(card);
  }
}



// === Modal Logic ===
async function openModal(item, type) {
  // Make sure episode modal is fully reset
  const episodeHero = document.getElementById('episodeHeroModal');
  if (episodeHero) {
    episodeHero.classList.add('hidden');
    episodeHero.style.opacity = 0;
  }
  
  const heroEpisodeContainer = document.getElementById('hero-episode-dropdown-container');
  if (heroEpisodeContainer) {
    heroEpisodeContainer.style.display = 'none';
  }
  
  const heroEpisodeDropdown = document.getElementById('heroEpisodeDropdown');
  if (heroEpisodeDropdown) {
    heroEpisodeDropdown.classList.add('hidden');
  }
  
  const heroSeasonSelect = document.getElementById('hero-season-select');
  if (heroSeasonSelect) {
    heroSeasonSelect.innerHTML = '';
  }

  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const modalOverview = document.getElementById('modal-overview');
  const modalMeta = document.getElementById('modal-meta');
  const modalMainBtn = document.getElementById('modal-main-btn');
  const modalBg = document.getElementById('modal-bg-sharp');
  const trailerBg = document.getElementById('modal-trailer-bg');

  if (!modal) return;

  try {
    const res = await fetch(`${TMDB_BASE}/${type}/${item.id}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos`);
    const details = await res.json();

    const title = details.title || details.name || 'Untitled';
    const overview = details.overview || 'No description available.';
    const bgPath = details.backdrop_path || details.poster_path || '';
    const year = (details.release_date || details.first_air_date)
      ? new Date(details.release_date || details.first_air_date).getFullYear()
      : 'N/A';
    const rating = details.vote_average?.toFixed(1) || 'N/A';
    const runtime = details.runtime || (details.episode_run_time?.[0] || null);
    const genres = details.genres?.map(g => g.name).join(', ') || 'Unknown';
    
    if (type === 'movie') {
      // SHOW red "▶ Watch Now"
      if (modalMainBtn) {
        modalMainBtn.innerHTML = '▶ Watch Now';
        modalMainBtn.classList.add('btn-primary');
        modalMainBtn.classList.remove('btn-secondary');
        modalMainBtn.onclick = () => openViewingPage(details, 'movie');
      }

      const episodeDropdownContainer = document.getElementById('episode-dropdown-container');
      if (episodeDropdownContainer) {
        episodeDropdownContainer.style.display = 'none';
      }

    } else {
      // SHOW red "📺 Choose Episode"
      if (modalMainBtn) {
        modalMainBtn.innerHTML = '📺 Choose Episode';
        modalMainBtn.classList.add('btn-primary');
        modalMainBtn.classList.remove('btn-secondary');
        modalMainBtn.onclick = () => {
          const dropdown = document.getElementById('episodeDropdown');
          if (dropdown) {
            dropdown.classList.toggle('hidden');
          }
        };
      }

      // Show episode UI
      const episodeDropdownContainer = document.getElementById('episode-dropdown-container');
      if (episodeDropdownContainer) {
        episodeDropdownContainer.style.display = 'block';
      }
      await loadSeasons(details.id);
    }

    // Set top hero modal content
    const modalTitleImg = document.getElementById('modal-title-img');
const modalTitleText = document.getElementById('modal-title');

const logoUrl = await loadTitleLogo(details.id, type);
if (logoUrl && modalTitleImg && modalTitleText) {
  modalTitleImg.src = logoUrl;
  modalTitleImg.loading = 'lazy';
  modalTitleImg.style.display = 'block';
  modalTitleText.style.display = 'none';
} else {
  if (modalTitleText) {
    modalTitleText.textContent = title;
    modalTitleText.style.display = 'block';
  }
  if (modalTitleImg) {
    modalTitleImg.style.display = 'none';
  }
}

    if (modalOverview) modalOverview.textContent = overview;
    if (modalMeta) {
      modalMeta.innerHTML = `<div class="meta-item">${type === 'tv' ? 'TV Show' : 'Movie'}</div>`;
    }

    const modalExtraInfo = document.getElementById('modal-extra-info');
    if (modalExtraInfo) {
      modalExtraInfo.innerHTML = `
        <div class="meta-item" data-icon="⭐"><strong>${rating}</strong><span>IMDb Rating</span></div>
        <div class="meta-item" data-icon="📅"><strong>${year}</strong><span>Release Year</span></div>
        ${runtime ? `<div class="meta-item" data-icon="⏱"><strong>${runtime} min</strong><span>Runtime</span></div>` : ''}
        <div class="meta-item" data-icon="🎬"><strong>${genres}</strong><span>Genres</span></div>
      `;
    }

    // Set cast (but delay rendering to allow modal to animate)
    const castContainer = document.getElementById('modal-cast-grid');
    if (castContainer) {
      castContainer.innerHTML = '';
      
      const cast = details.credits?.cast?.slice(0, 10) || [];
      
      // Defer population to avoid lag during modal open
      setTimeout(() => {
        cast.forEach((actor, i) => {
          const card = document.createElement('div');
          card.classList.add('cast-card');

          // Optional: staggered animation delay
          card.style.animation = `fadeSlideIn 0.4s ease ${i * 50}ms forwards`;
          card.style.opacity = '0'; // invisible until animation starts

          card.innerHTML = `
            <div class="cast-img-wrap">
              <img 
  src="${IMG_BASE_W342 + actor.profile_path}" 
  srcset="${IMG_BASE_W342 + actor.profile_path} 342w, ${IMG_BASE_W500 + actor.profile_path} 500w"
  sizes="(max-width: 600px) 342px, 500px"
  alt="${actor.name}" 
  loading="lazy" 
/>
            </div>
            <div class="cast-info">
              <div class="cast-name">${actor.name}</div>
              <div class="cast-role">${actor.character || ''}</div>
            </div>
          `;

          castContainer.appendChild(card);
        });
      }, 100);
    }

    // Set fullscreen background
    if (modalBg) {
      modalBg.style.backgroundImage = `url(${ORIGINAL_IMG + bgPath})`;
    }

    // Handle trailer
    const trailers = details.videos?.results?.filter(v =>
      v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
    );
    const trailer = trailers?.[0];

    if (trailerBg) {
      trailerBg.innerHTML = '';
      trailerBg.style.opacity = 0;

      if (trailer) {
        clearTimeout(trailerTimer);
        trailerBg.innerHTML = `
          <iframe id="modal-trailer-iframe"
            src="https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=1&controls=0&rel=0&showinfo=0&modestbranding=1&enablejsapi=1"
            frameborder="0"
            allow="autoplay; encrypted-media"
            allowfullscreen
            style="width:100%; height:100%; border:none; pointer-events: none;">
          </iframe>
          <div class="trailer-mask"></div>
        `;

        trailerTimer = setTimeout(() => {
          trailerBg.style.opacity = 1;
          document.querySelector('.glass-modal')?.classList.add('trailer-active');

          const ytIframe = trailerBg.querySelector('iframe');
          if (window.YT && ytIframe) {
            ytPlayer = new YT.Player(ytIframe, {
              events: {
                onStateChange: event => {
                  if (event.data === YT.PlayerState.ENDED) {
                    trailerBg.style.opacity = 0;
                    document.querySelector('.glass-modal')?.classList.remove('trailer-active');
                    setTimeout(() => {
                      trailerBg.innerHTML = '';
                      modalBg.style.backgroundImage = `url(${ORIGINAL_IMG + bgPath})`;
                      if (ytPlayer && ytPlayer.destroy) ytPlayer.destroy();
                      ytPlayer = null;
                    }, 600);
                  }
                }
              }
            });
          }
        }, 5000);
      }
    }

    // Show modal with preloaded background
    const preloadImage = new Image();
    preloadImage.src = ORIGINAL_IMG + bgPath;
    preloadImage.onload = () => {
      if (modalBg) {
        modalBg.style.backgroundImage = `url(${preloadImage.src})`;
      }
      
      modal.style.display = 'block';
      requestAnimationFrame(() => {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    };

  } catch (err) {
    console.error('Modal error:', err);
  }
}

function closeModalHandler() {
  const heroSeasonSelect = document.getElementById('hero-season-select');
  if (heroSeasonSelect) heroSeasonSelect.innerHTML = '';

  const seasonSelect = document.getElementById('season-select');
  if (seasonSelect) seasonSelect.innerHTML = '';

  const heroDropdown = document.getElementById('heroEpisodeDropdown');
  if (heroDropdown) heroDropdown.innerHTML = '';

  const episodeDropdown = document.getElementById('episodeDropdown');
  if (episodeDropdown) episodeDropdown.innerHTML = '';

  const modal = document.getElementById('modal');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300);
  }
  
  document.body.style.overflow = 'auto';

  const modalBg = document.getElementById('modal-bg-sharp');
  if (modalBg) modalBg.style.backgroundImage = '';

  const episodesGrid = document.getElementById('episodes-grid');
  if (episodesGrid) episodesGrid.innerHTML = '';

  clearTimeout(trailerTimer);
  if (ytPlayer && ytPlayer.destroy) ytPlayer.destroy();

  const trailerBg = document.getElementById('modal-trailer-bg');
  if (trailerBg) trailerBg.innerHTML = '';

  const episodeHeroModal = document.getElementById('episodeHeroModal');
  if (episodeHeroModal) {
    episodeHeroModal.classList.add('hidden');
    episodeHeroModal.style.opacity = 0;
  }
}

// === Open VIDEASY Player In-Page ===
function openViewingPage(item, type, season = 1, episode = 1, dub = false) {
  const viewingPage = document.getElementById('viewing-page');
  const videasyWrapper = document.getElementById('videasy-wrapper');
  const titleElement = document.getElementById('viewing-title');
  viewingPage.classList.add('active');


  if (!viewingPage || !videasyWrapper) {
    console.error('Viewing page elements not found');
    return;
  }

  const id = item?.id || item?.show_id || item?.movie_id || item?.anilist_id;
  const name = item?.title || item?.name || "Now Playing";
  const color = '8B5CF6';
  let videoUrl = '';
  
  if (type === 'movie') {
    videoUrl = `https://player.videasy.net/movie/${id}?color=${color}&autoplay=1`;
  } else if (type === 'tv') {
    videoUrl = `https://player.videasy.net/tv/${id}/${season}/${episode}?color=${color}&episodeSelector=true&autoplayNextEpisode=true&nextEpisode=true&autoplay=1`;
  } else if (type === 'anime') {
    videoUrl = `https://player.videasy.net/anime/${id}/${episode}?color=${color}&dub=${dub}`;
  }

  console.log('Opening VIDEASY player with URL:', videoUrl);

  // Create the iframe
  const iframe = `
    <div style="position: relative; padding-bottom: 56.25%; height: 0;">
      <iframe
        src="${videoUrl}"
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
        frameborder="0"
        allowfullscreen
        allow="autoplay; encrypted-media">
      </iframe>
    </div>
  `;

  videasyWrapper.innerHTML = iframe;
  
  if (titleElement) {
    titleElement.textContent = name;
  }

  function playWithVideasy(videoUrl, title = "Now Playing") {
    document.getElementById("viewing-page").classList.remove("hidden");
    document.getElementById("viewing-title").textContent = title;
  
    const wrapper = document.getElementById("videasy-wrapper");
    wrapper.innerHTML = `
      <iframe 
        src="${videoUrl}" 
        width="100%" 
        height="600" 
        frameborder="0" 
        allow="autoplay; fullscreen" 
        allowfullscreen
        class="videasy-iframe">
      </iframe>
    `;
  }
  
  // Close modal if it's open
  const modal = document.getElementById('modal');
  if (modal && modal.classList.contains('active')) {
    closeModalHandler();
  }

  // Hide other pages and show viewing page
  document.getElementById('main-content').style.display = 'none';
  document.getElementById('hero-section').style.display = 'none';
  document.getElementById('navbar').style.display = 'none';  
  
  viewingPage.classList.remove('hidden');
  document.body.style.overflow = 'hidden'; 
}

function closeViewingPage() {
  const viewingPage = document.getElementById('viewing-page');
  const videasyWrapper = document.getElementById('videasy-wrapper');

  // Hide viewing page
  if (viewingPage) {
    viewingPage.classList.remove('active');
    setTimeout(() => {
      viewingPage.classList.add('hidden');
    }, 300); // match the transition duration
  }

  // Show other pages
  document.getElementById('main-content').style.display = '';
  document.getElementById('hero-section').style.display = '';
  document.getElementById('navbar').style.display = '';
  document.body.style.overflow = 'auto';

  // Clear iframe
  if (videasyWrapper) {
    videasyWrapper.innerHTML = '';
  }
}

// === TV Show Episode Loader ===
async function loadSeasons(tvId, intoHero = false, selectedSeason = null) {
  try {
    const res = await fetch(`${TMDB_BASE}/tv/${tvId}?api_key=${TMDB_API_KEY}`);
    const data = await res.json();
    const seasons = data.seasons || [];

    const seasonSelect = document.getElementById(intoHero ? 'hero-season-select' : 'season-select');
    const dropdown = document.getElementById(intoHero ? 'heroEpisodeDropdown' : 'episodeDropdown');

    if (!seasonSelect) return;

    seasonSelect.innerHTML = '';
    seasons.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.season_number;
      opt.textContent = s.name;
      if (selectedSeason !== null && Number(selectedSeason) === s.season_number) {
        opt.selected = true;
      }
      seasonSelect.appendChild(opt);
    });

    const currentSeason = selectedSeason ?? seasonSelect.value ?? 1;

    // Load default or current season
    await loadEpisodes(tvId, currentSeason, intoHero);

    seasonSelect.onchange = () => loadEpisodes(tvId, seasonSelect.value, intoHero);
    
    // Only setup toggle if we're in the fullscreen episode hero
    if (intoHero) {
      const toggleBtn = document.getElementById('heroDropdownBtn');
      if (toggleBtn && dropdown) {
        toggleBtn.onclick = () => dropdown.classList.toggle('hidden');
      }
    }
  } catch (err) {
    console.error('Error loading seasons:', err);
  }
}

async function loadEpisodes(tvId, seasonNumber = 1, intoHero = false) {
  try {
    const res = await fetch(`${TMDB_BASE}/tv/${tvId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`);
    const data = await res.json();
    const container = document.getElementById(intoHero ? 'heroEpisodeDropdown' : 'episodeDropdown');
    
    if (!container) return;
    
    container.innerHTML = '';

    data.episodes.forEach((ep, i) => {
      const div = document.createElement('div');
      div.className = 'episode-item';
      div.textContent = `${ep.episode_number}. ${ep.name}`;
      div.onclick = () => showEpisodeHero({
        ...ep,
        show_id: tvId,
        season_number: seasonNumber,
        episode_number: ep.episode_number
      });
      container.appendChild(div);
    });
  } catch (err) {
    console.error('Error loading episodes:', err);
  }
}

async function showEpisodeHero(ep) {
  const modal = document.getElementById('episodeHeroModal');
  const title = document.getElementById('episodeHeroTitle');
  const overview = document.getElementById('episodeHeroOverview');
  const watchBtn = document.getElementById('episodeWatchBtn');

  if (!modal) return;

  // Set background image
  const bgImage = ep.still_path
    ? `https://image.tmdb.org/t/p/original${ep.still_path}`
    : 'https://via.placeholder.com/1920x1080?text=No+Image';
  modal.style.backgroundImage = `url('${bgImage}')`;

  // Set content
  if (title) title.textContent = `${ep.episode_number}. ${ep.name || 'Untitled'}`;
  if (overview) overview.textContent = ep.overview || 'No description available.';

  // Resolve official TMDB ID for the show before opening player
  if (watchBtn) {
    watchBtn.onclick = async () => {
      const officialId = await getOfficialTmdbId({ id: ep.show_id, name: ep.show_name || ep.name });
      if (officialId) {
        openViewingPage({ ...ep, show_id: officialId, id: officialId }, 'tv', ep.season_number, ep.episode_number);
      } else {
        console.error('Failed to get official TMDB ID for episode show:', ep.show_id);
        // Fallback: open with the current ID anyway
        openViewingPage(ep, 'tv', ep.season_number, ep.episode_number);
      }
    };
  }

  // Load seasons with correct selected season preserved
  loadSeasons(ep.show_id, true, ep.season_number);

  // Show modal with animation
  modal.classList.remove('hidden');
  modal.classList.remove('fade-in');
  void modal.offsetWidth;
  modal.classList.add('fade-in');

  // Show the episode dropdown container
  const heroEpisodeContainer = document.getElementById('hero-episode-dropdown-container');
  if (heroEpisodeContainer) {
    heroEpisodeContainer.style.display = 'block';
  }
}

function closeEpisodeHeroModal() {
  const modal = document.getElementById('episodeHeroModal');
  if (modal) {
    modal.classList.add('hidden');
  }
  document.body.style.overflow = 'auto';
}

// === Search Functionality ===
let searchDebounceTimer;
const searchInput = document.getElementById('searchInput');

if (searchInput) {
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();

    // Always show the search page when typing
    const searchPage = document.getElementById('search-page');
    if (searchPage) {
      searchPage.classList.remove('hidden','hiding');
      searchPage.classList.add('visible');
      searchPage.style.display = 'block';
    }

    // Debounce to avoid spamming the API
    clearTimeout(searchDebounceTimer);
    if (!query) {
      if (searchCarousel) {
        searchCarousel.innerHTML = '';
      }
      return;
    }

    searchDebounceTimer = setTimeout(() => {
      performLiveSearch(query);
    }, 300);
  });
}

async function performLiveSearch(query) {
  const searchGrid = document.getElementById('search-carousel');
  if (!searchGrid) return;
  
  searchGrid.innerHTML = '';

  try {
    const res = await fetch(`${TMDB_BASE}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
    const data = await res.json();

    data.results.forEach(item => {
      const title = item.title || item.name || 'Untitled';
      const basePath = item.backdrop_path || item.poster_path || '';
      const smallImg = basePath ? `${IMG_BASE_W342}${basePath}` : '';
      const mediumImg = basePath ? `${IMG_BASE_W500}${basePath}` : '';
      const largeImg = basePath ? `${IMG_BASE_W780}${basePath}` : '';       
      const rating = item.vote_average?.toFixed(1) || 'N/A';

      const card = document.createElement('div');
      card.className = 'movie-card';
      card.innerHTML = `
  <img 
    class="movie-poster" 
    src="${smallImg}" 
    srcset="${smallImg} 342w, ${mediumImg} 500w, ${largeImg} 780w" 
    sizes="(max-width: 600px) 342px, (max-width: 1200px) 500px, 780px" 
    alt="${title}" 
    loading="lazy" 
  />
  <div class="rating-badge">⭐ ${rating}</div>
`;

      card.onclick = async () => {
        const type = item.media_type || (item.first_air_date ? 'tv' : 'movie');
        if (type === 'tv') {
          const officialId = await getOfficialTmdbId(item);
          if (officialId) {
            openModal({ ...item, id: officialId }, type);
          } else {
            console.error('Invalid TV show ID for', item.name || item.title);
          }
        } else {
          openModal(item, type);
        }
      };

      searchGrid.appendChild(card);
    });
  } catch (err) {
    console.error('Live search error:', err);
  }
}


function closeSearchPage() {
  const searchPage = document.getElementById('search-page');
  if (!searchPage) return;

  searchPage.classList.remove('visible');
  searchPage.classList.add('hiding');

  setTimeout(() => {
    searchPage.classList.remove('hiding');
    searchPage.classList.add('hidden');
  }, 400);
}

async function getOfficialTmdbId(item) {
  const TMDB_API_KEY = '4130de3474cebb9a3f97764b7e97d943';
  const TMDB_BASE = 'https://api.themoviedb.org/3';

  // If item has an id, try fetching details to confirm validity
  if (item?.id) {
    try {
      const res = await fetch(`${TMDB_BASE}/tv/${item.id}?api_key=${TMDB_API_KEY}`);
      if (res.ok) return item.id;
    } catch { /* fail silently */ }
  }

  // If invalid or no id, try searching by name
  const name = item?.name || item?.title;
  if (!name) return null;

  try {
    const searchRes = await fetch(`${TMDB_BASE}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}`);
    if (!searchRes.ok) return null;

    const data = await searchRes.json();
    if (data.results && data.results.length > 0) {
      return data.results[0].id;
    }
  } catch {}

  return null;
}

const searchContainer = document.getElementById('searchContainer');
  const searchButton = document.getElementById('searchButton');

  searchButton.addEventListener('click', (e) => {
    e.stopPropagation();
  
    const alreadyExpanded = searchContainer.classList.contains('expanded');
    const query = searchInput.value.trim();
  
    if (alreadyExpanded && query) {
      // Trigger live search manually
      const searchPage = document.getElementById('search-page');
      if (searchPage) {
        searchPage.classList.remove('hidden', 'hiding');
        searchPage.classList.add('visible');
        searchPage.style.display = 'block';
      }
  
      performLiveSearch(query); // ← use your real search logic here
    } else {
      searchContainer.classList.add('expanded');
      searchInput.focus();
    }
  });  

  // Collapse when clicking outside or pressing Esc
  document.addEventListener('click', (e) => {
    if (!searchContainer.contains(e.target)) {
      searchContainer.classList.remove('expanded');
      searchInput.value = '';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchContainer.classList.remove('expanded');
      searchInput.value = '';
    }
  });
  

  async function init() {
    try {
      await loadHero(); // ← Just load hero first
      preloadHeroAssets(); // ← Optional but nice
      lazyLoadCarousels(); // ← replace bulk load
  
      // Slight delay before loading carousels
      setTimeout(() => {
        Object.entries(carousels).forEach(([id, config], i) => {
          setTimeout(() => loadCarousel(id, config), i * 200); // Stagger with delay
        });
      }, 500); // Delay first carousel load by 500ms
  
      setupTrendingHover();
      console.log('🎬 Noahflix Ultra loaded successfully');
    } catch (err) {
      console.error('Error initializing app:', err);
    }
  }
  

  function setupCarouselFadeIn() {
    const carousels = document.querySelectorAll('.carousel');
  
    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target); // Only trigger once
        }
      });
    }, {
      threshold: 0.2 // Trigger when 20% is visible
    });
  
    carousels.forEach(carousel => observer.observe(carousel));
  }
  
  // Make sure this runs after carousels are loaded
  setupCarouselFadeIn();
  
  

// Variable to track if hovering over a card
let hoveredHeroIndex = null;

function setupTrendingHover() {
  const trendingCarousel = document.getElementById('trending-carousel');
  if (!trendingCarousel) return;

  trendingCarousel.addEventListener('mouseover', async (e) => {
    const card = e.target.closest('.movie-card');
    if (!card) return;

    // Find the index of the hovered card in the carousel's cards list
    const cards = Array.from(trendingCarousel.querySelectorAll('.movie-card'));
    hoveredHeroIndex = cards.indexOf(card);
    if (hoveredHeroIndex < 0) return;

    // Show the hovered movie in the hero (without changing currentHeroIndex)
    await showHero(hoveredHeroIndex);
  });

  trendingCarousel.addEventListener('mouseout', async (e) => {
    // Only reset if we had hovered a card before
    if (hoveredHeroIndex !== null) {
      hoveredHeroIndex = null;
      // Restore hero to currently selected movie
      await showHero(currentHeroIndex);
    }
  });
}

function lazyLoadCarousels() {
  const sections = document.querySelectorAll('.carousel');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        const config = carousels[id];
        if (config) loadCarousel(id, config);
        observer.unobserve(entry.target); // only load once
      }
    });
  });

  sections.forEach(section => observer.observe(section));
}

const logoCache = {};
const backdropCache = {};

// In your main JS, when site is ready (e.g., after initial data and images loaded):
window.addEventListener('load', () => {
  const splash = document.getElementById('splash');
  splash.style.opacity = '0';
  setTimeout(() => {
    splash.style.display = 'none';
  }, 800);
});

  const minSplashTime = 5000; // 3 seconds
  const splashStart = Date.now();

  window.addEventListener('load', () => {
    const elapsed = Date.now() - splashStart;
    const splash = document.getElementById('splash');
    
    const fadeOut = () => {
      splash.style.opacity = '0';
      setTimeout(() => {
        splash.style.display = 'none';
      }, 800);
    };

    if (elapsed < minSplashTime) {
      setTimeout(fadeOut, minSplashTime - elapsed);
    } else {
      fadeOut();
    }
  });


// Start the app
init();
