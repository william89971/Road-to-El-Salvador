import { useEffect, useRef, useState, useReducer } from 'react';
import { gameState, tick, resetGame, CONFIG, LOADOUTS } from './game-engine/gameStateAndRules.js';
import { ROUTE, BIOMES } from './map-data/citiesAndRoute.js';
import { ParallaxScene } from './game-engine/drivingScene3D.js';
import { audio } from './game-engine/soundEffects.js';
import StartScreen from './screens/StartScreen.jsx';
import HeadsUpDisplay from './screens/HeadsUpDisplay.jsx';
import CityStopShop from './screens/CityStopShop.jsx';
import NewspaperEventCard from './screens/NewspaperEventCard.jsx';
import GameOverScreen from './screens/GameOverScreen.jsx';
import VictoryScreen from './screens/VictoryScreen.jsx';
import ShootingMinigameScreen from './screens/ShootingMinigameScreen.jsx';
import RouteMapScreen from './screens/RouteMapScreen.jsx';
import ArrivalCinematic from './screens/ArrivalCinematic.jsx';
import LeaderboardScreen from './screens/LeaderboardScreen.jsx';
import NameBanner from './screens/NameBanner.jsx';
import { getEvent } from './events/eventGenerator.js';
import { applyEffects } from './game-engine/gameStateAndRules.js';
import { saveRun } from './game-engine/leaderboardStorage.js';

export default function GameController() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const [, forceRender] = useReducer((n) => n + 1, 0);
  const [showMap, setShowMap] = useState(false);
  const [eventData, setEventData] = useState(null);
  const eventDataRef = useRef(null);
  const [shooter, setShooter] = useState(null); // null | { source }
  const [muted, setMuted] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [nameBanner, setNameBanner] = useState(null); // ROUTE stop shown as a cinematic banner
  const bannerTimerRef = useRef(null);
  const eventTimerRef = useRef(0); // ms until next random event (reset per run)

  // audio reaction bookkeeping
  const audioRef = useRef({ histLen: 1, btc: CONFIG.START_BTC_PRICE, gasAlarm: false, suvAlarm: false, engine: false });

  // ---- mount the single Three.js scene + run the rAF loop ----------------
  useEffect(() => {
    const scene = new ParallaxScene(canvasRef.current);
    sceneRef.current = scene;
    if (import.meta.env.DEV) { window.gameState = gameState; window.__fireEvent = fireEvent; } // dev-only debug handles (stripped from production build)

    let raf, last = performance.now();
    eventTimerRef.current = scheduleNextEvent();

    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); // clamp big tab-switch gaps
      last = now;

      tick(dt);
      handleCityStops();
      if (gameState.screen === 'playing' && !gameState.paused) {
        eventTimerRef.current -= dt * 1000;
        if (eventTimerRef.current <= 0) { fireEvent(); eventTimerRef.current = scheduleNextEvent(); }
      }
      handleArrival();
      reactAudio();

      scene.update(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onResize = () => scene.resize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', onResize);

    // React<-state sync at 10Hz
    const sync = setInterval(forceRender, 100);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      clearInterval(sync);
      scene.dispose();
    };
  }, []);

  // ---- orchestration helpers --------------------------------------------
  function scheduleNextEvent() {
    return CONFIG.EVENT_MIN_MS + Math.random() * (CONFIG.EVENT_MAX_MS - CONFIG.EVENT_MIN_MS);
  }

  // Engine hum lifecycle + BTC-up ping + low-resource alarm.
  function reactAudio() {
    const a = audioRef.current;
    const playing = gameState.screen === 'playing';
    const running = playing && !gameState.paused; // engine hums only while actually driving

    if (running && audio.on && !a.engine) { audio.startEngine(); a.engine = true; }
    if ((!running || !audio.on) && a.engine) { audio.stopEngine(); a.engine = false; }
    if (!playing) return;

    // ping when a fresh, higher BTC price point lands
    const len = gameState.btcPriceHistory.length;
    if (len !== a.histLen) {
      if (gameState.btcPrice > a.btc) audio.ping(900);
      a.histLen = len; a.btc = gameState.btcPrice;
    }

    // one alarm per dip below 20% (rearm at 25%)
    if (gameState.gas < 20 && !a.gasAlarm) { audio.alarm(); a.gasAlarm = true; }
    if (gameState.gas >= 25) a.gasAlarm = false;
    if (gameState.suvHealth < 20 && !a.suvAlarm) { audio.alarm(); a.suvAlarm = true; }
    if (gameState.suvHealth >= 25) a.suvAlarm = false;
  }

  function fireEvent() {
    // Don't stack an event on top of a city stop or another event.
    if (gameState.cityStopIndex >= 0 || eventDataRef.current) return;
    gameState.paused = true;
    getEvent().then((ev) => {
      eventDataRef.current = ev;
      setEventData(ev);
    }).catch(() => { gameState.paused = false; });
  }

  // keep only a few recent titles so the small mock-event pool still rotates
  const rememberEvent = (title) => {
    if (!title) return;
    gameState.recentEventTitles.push(title);
    if (gameState.recentEventTitles.length > 3) gameState.recentEventTitles.shift();
  };

  const resolveEvent = (effects, ev) => {
    applyEffects(effects);
    rememberEvent(ev.headline);
    gameState.eventsSurvived++;
    eventDataRef.current = null;
    setEventData(null);
    gameState.paused = false;
  };

  const fightEvent = () => {
    // "Stand your ground" opens the WaveShooter instead of applying effects.
    // eventsSurvived is credited when the shooter actually resolves (endShooter).
    rememberEvent(eventDataRef.current?.headline);
    eventDataRef.current = null;
    setEventData(null);
    setShooter({ source: 'event' }); // stays paused until the shooter resolves
  };

  function handleCityStops() {
    if (gameState.screen !== 'playing') return;
    for (let i = ROUTE.length - 1; i > gameState.lastStopIndex; i--) {
      if (gameState.miles >= ROUTE[i].mile) {
        const stop = ROUTE[i];
        gameState.lastStopIndex = i;
        gameState.currentCity = stop.name;
        gameState.currentCountry = stop.country;
        gameState.biome = stop.biome;
        // Open the city-stop modal for every stop except the final destination
        // (San Salvador, which is handled by the arrival sequence). A name-banner
        // cinematic plays first, then the shop opens.
        if (i < ROUTE.length - 1) {
          gameState.paused = true;
          setNameBanner(stop);
          clearTimeout(bannerTimerRef.current);
          bannerTimerRef.current = setTimeout(() => {
            setNameBanner(null);
            gameState.cityStopIndex = i;
            forceRender();
          }, 3000);
        }
        break;
      }
    }
  }

  function handleArrival() {
    if (gameState.screen === 'playing' && gameState.miles >= CONFIG.TOTAL_MILES) {
      gameState.screen = 'arrival';
    }
  }

  // ---- screen actions ----------------------------------------------------
  const resetAudioBookkeeping = () => {
    audioRef.current = { histLen: 1, btc: CONFIG.START_BTC_PRICE, gasAlarm: false, suvAlarm: false, engine: audioRef.current.engine };
  };

  const handleStart = (name, difficulty, loadout, suvColor) => {
    audio.init();
    resetGame(name, difficulty, loadout, suvColor);
    gameState.lastStopIndex = 0; // already at LA (index 0)
    gameState.cityStopIndex = -1;
    eventDataRef.current = null;
    setEventData(null);
    clearTimeout(bannerTimerRef.current);
    setNameBanner(null);
    eventTimerRef.current = scheduleNextEvent();
    resetAudioBookkeeping();
    forceRender();
  };

  const leaveCityStop = () => {
    const i = gameState.cityStopIndex;
    gameState.cityStopIndex = -1;
    if (ROUTE[i] && ROUTE[i].dangerous) {
      // Dangerous stop (Tegucigalpa) pushes you straight into an ambush.
      setShooter({ source: 'stop' }); // stays paused until the shooter resolves
    } else {
      gameState.paused = false;
    }
    forceRender();
  };

  const endShooter = () => {
    // a "Stand your ground" event only counts as survived once the ambush resolves
    if (shooter?.source === 'event') gameState.eventsSurvived++;
    setShooter(null);
    gameState.paused = false;
    forceRender();
  };

  const togglePause = () => { gameState.paused = !gameState.paused; forceRender(); };
  const toggleMap = () => { setShowMap((v) => !v); };
  const toggleMute = () => {
    audio.on = !audio.on;
    setMuted(!audio.on);
    if (!audio.on) { audio.stopEngine(); audioRef.current.engine = false; }
  };

  const restart = () => {
    resetGame(gameState.playerName, gameState.difficulty, LOADOUTS[gameState.loadoutId], gameState.suvColor);
    gameState.lastStopIndex = 0;
    gameState.cityStopIndex = -1;
    eventDataRef.current = null;
    setEventData(null);
    setShooter(null);
    clearTimeout(bannerTimerRef.current);
    setNameBanner(null);
    eventTimerRef.current = scheduleNextEvent();
    resetAudioBookkeeping();
    forceRender();
  };
  const toMenu = () => {
    gameState.screen = 'start';
    setShooter(null);
    eventDataRef.current = null;
    setEventData(null);
    clearTimeout(bannerTimerRef.current);
    setNameBanner(null);
    forceRender();
  };

  // ---- render ------------------------------------------------------------
  const s = gameState;
  return (
    <>
      <canvas ref={canvasRef} style={styles.canvas} />

      {s.screen === 'start' && (
        <StartScreen onStart={handleStart} onShowLeaderboard={() => setShowLeaderboard(true)} />
      )}

      {s.screen === 'playing' && (
        <>
          <HeadsUpDisplay onToggleMap={toggleMap} onTogglePause={togglePause} onToggleMute={toggleMute} muted={muted} />
          {s.cityStopIndex >= 0 && (
            <CityStopShop index={s.cityStopIndex} onContinue={leaveCityStop} />
          )}
          {eventData && !shooter && (
            <NewspaperEventCard event={eventData} onChoose={resolveEvent} onFight={fightEvent} />
          )}
          {shooter && (
            <ShootingMinigameScreen biome={gameState.biome} onDone={endShooter} />
          )}
          {showMap && <RouteMapScreen onClose={() => setShowMap(false)} />}
          {nameBanner && <NameBanner stop={nameBanner} />}
          {s.paused && s.cityStopIndex < 0 && !eventData && !nameBanner && (
            <div style={styles.pauseOverlay} onClick={togglePause}>
              <div style={{ fontFamily: 'var(--font-title)', fontSize: 48 }}>PAUSED</div>
              <div style={{ fontFamily: 'var(--font-num)', fontSize: 14, opacity: 0.8 }}>click to resume</div>
            </div>
          )}
        </>
      )}

      {s.screen === 'gameover' && <GameOverScreen onRestart={restart} onMenu={toMenu} />}

      {s.screen === 'arrival' && (
        <ArrivalCinematic onDone={() => { gameState.screen = 'victory'; saveRun(); forceRender(); }} />
      )}

      {s.screen === 'victory' && (
        <VictoryScreen onRestart={restart} onMenu={toMenu} onShowLeaderboard={() => setShowLeaderboard(true)} />
      )}

      {showLeaderboard && <LeaderboardScreen onClose={() => setShowLeaderboard(false)} />}
    </>
  );
}

const styles = {
  canvas: { position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 0 },
  pauseOverlay: {
    position: 'fixed', inset: 0, zIndex: 40, display: 'grid', placeItems: 'center',
    background: 'rgba(26,20,17,0.6)', color: 'var(--paper)', cursor: 'pointer', textAlign: 'center',
  },
};
