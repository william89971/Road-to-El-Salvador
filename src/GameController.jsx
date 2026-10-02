import { useEffect, useRef, useState, useReducer } from 'react';
import { gameState, resetGame, CONFIG, LOADOUTS } from './game-engine/gameStateAndRules.js';
import { ROUTE } from './map-data/citiesAndRoute.js';
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
import {
  setPaused, togglePause as togglePausedAction, setScreen, setCurrentStop, clearStop,
  setLastStopIndex, incrementEventsSurvived,
  rememberEventTitle,
} from './game-engine/gameActions.js';
import { createGameLoop } from './game-engine/gameLoop.js';
import { saveRun } from './game-engine/leaderboardStorage.js';
import { saveCheckpoint, loadCheckpoint, clearCheckpoint, restoreCheckpoint } from './game-engine/runSave.js';

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
  const [webglError, setWebglError] = useState(false);
  const bannerTimerRef = useRef(null);
  const pendingStopRef = useRef(null);
  const loopRef = useRef(null);

  // audio reaction bookkeeping
  const audioRef = useRef({ histLen: 1, btc: CONFIG.START_BTC_PRICE, gasAlarm: false, suvAlarm: false, engine: false });

  // ---- mount the single Three.js scene + run the rAF loop ----------------
  useEffect(() => {
    let scene;
    try {
      scene = new ParallaxScene(canvasRef.current);
      sceneRef.current = scene;
    } catch (err) {
      console.error('Failed to initialize WebGL scene:', err);
      setWebglError(true);
      return;
    }
    if (import.meta.env.DEV) { window.gameState = gameState; window.__fireEvent = fireEvent; } // dev-only debug handles (stripped from production build)

    const loop = createGameLoop({
      scene,
      onEventFire: fireEvent,
      onCityStop: (stop, index) => {
        pendingStopRef.current = index;
        setNameBanner(stop);
        clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = setTimeout(() => {
          if (pendingStopRef.current !== index) return;
          pendingStopRef.current = null;
          setNameBanner(null);
          openCity(index);
        }, 2600);
      },
      onAudioReact: reactAudio,
    });
    loopRef.current = loop;

    loop.start();

    const onResize = () => scene.resize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', onResize);

    // React<-state sync at 10Hz
    const sync = setInterval(forceRender, 100);

    return () => {
      loop.stop();
      window.removeEventListener('resize', onResize);
      clearInterval(sync);
      scene.dispose();
    };
  }, []);

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
    setPaused(true);
    getEvent().then((ev) => {
      eventDataRef.current = ev;
      setEventData(ev);
    }).catch(() => { setPaused(false); });
  }

  const resolveEvent = (effects, ev) => {
    applyEffects(effects);
    rememberEventTitle(ev.headline);
    incrementEventsSurvived();
    eventDataRef.current = null;
    setEventData(null);
    setPaused(false);
  };

  const fightEvent = () => {
    // "Stand your ground" opens the WaveShooter instead of applying effects.
    // eventsSurvived is credited when the shooter actually resolves (endShooter).
    rememberEventTitle(eventDataRef.current?.headline);
    eventDataRef.current = null;
    setEventData(null);
    setShooter({ source: 'event' }); // stays paused until the shooter resolves
  };

  // ---- screen actions ----------------------------------------------------
  const resetAudioBookkeeping = () => {
    audioRef.current = { histLen: 1, btc: CONFIG.START_BTC_PRICE, gasAlarm: false, suvAlarm: false, engine: audioRef.current.engine };
  };

  const openCity = (index) => {
    setCurrentStop(index);
    saveCheckpoint();
    forceRender();
  };

  const handleStart = (name, difficulty, loadout, suvColor) => {
    audio.init();
    clearCheckpoint();
    resetGame(name, difficulty, loadout, suvColor);
    setLastStopIndex(0); // already at LA (index 0)
    clearStop();
    eventDataRef.current = null;
    setEventData(null);
    clearTimeout(bannerTimerRef.current);
    pendingStopRef.current = null;
    setNameBanner(null);
    loopRef.current?.resetEventTimer();
    resetAudioBookkeeping();
    forceRender();
  };

  const skipBanner = () => {
    const index = pendingStopRef.current;
    if (index == null) return;
    pendingStopRef.current = null;
    clearTimeout(bannerTimerRef.current);
    setNameBanner(null);
    openCity(index);
  };

  const handleContinue = () => {
    const snap = loadCheckpoint();
    if (!snap) return;
    audio.init();
    restoreCheckpoint(snap);
    eventDataRef.current = null;
    setEventData(null);
    setShooter(null);
    clearTimeout(bannerTimerRef.current);
    pendingStopRef.current = null;
    setNameBanner(null);
    loopRef.current?.resetEventTimer();
    if (gameState.cityStopIndex >= 0) setPaused(true);
    resetAudioBookkeeping();
    audioRef.current.histLen = gameState.btcPriceHistory.length;
    audioRef.current.btc = gameState.btcPrice;
    forceRender();
  };

  const leaveCityStop = () => {
    const i = gameState.cityStopIndex;
    clearStop();
    if (ROUTE[i] && ROUTE[i].dangerous) {
      // Dangerous stop (Tegucigalpa) pushes you straight into an ambush.
      setShooter({ source: 'stop' }); // stays paused until the shooter resolves
    } else {
      setPaused(false);
      saveCheckpoint();
    }
    forceRender();
  };

  const endShooter = () => {
    const fromStop = shooter?.source === 'stop';
    // a "Stand your ground" event only counts as survived once the ambush resolves
    if (shooter?.source === 'event') incrementEventsSurvived();
    setShooter(null);
    setPaused(false);
    if (fromStop) saveCheckpoint();
    forceRender();
  };

  const togglePause = () => { togglePausedAction(); forceRender(); };
  const toggleMap = () => { setShowMap((v) => !v); };
  const toggleMute = () => {
    audio.on = !audio.on;
    setMuted(!audio.on);
    if (!audio.on) { audio.stopEngine(); audioRef.current.engine = false; }
  };

  const restart = () => {
    clearCheckpoint();
    resetGame(gameState.playerName, gameState.difficulty, LOADOUTS[gameState.loadoutId], gameState.suvColor);
    setLastStopIndex(0);
    clearStop();
    eventDataRef.current = null;
    setEventData(null);
    setShooter(null);
    clearTimeout(bannerTimerRef.current);
    pendingStopRef.current = null;
    setNameBanner(null);
    loopRef.current?.resetEventTimer();
    resetAudioBookkeeping();
    forceRender();
  };
  const toMenu = () => {
    setScreen('start');
    setShooter(null);
    eventDataRef.current = null;
    setEventData(null);
    clearTimeout(bannerTimerRef.current);
    pendingStopRef.current = null;
    setNameBanner(null);
    forceRender();
  };

  // ---- render ------------------------------------------------------------
  const s = gameState;
  if (webglError) {
    return (
      <div style={styles.fallbackWrap}>
        <div style={styles.fallbackCard}>
          <div style={{ fontSize: 48 }}>🛻🚧</div>
          <h1 style={styles.fallbackTitle}>3D Road Blocked</h1>
          <p style={styles.fallbackBody}>
            Your browser or device doesn’t support the WebGL features this trip needs.
            Try a different browser or enable hardware acceleration.
          </p>
          <button style={styles.fallbackBtn} onClick={() => window.location.reload()}>
            TRY AGAIN
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <canvas ref={canvasRef} style={styles.canvas} />

      {s.screen === 'start' && (
        <StartScreen onStart={handleStart} onContinue={handleContinue} onShowLeaderboard={() => setShowLeaderboard(true)} />
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
          {nameBanner && <NameBanner stop={nameBanner} onSkip={skipBanner} />}
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
        <ArrivalCinematic onDone={() => { clearCheckpoint(); setScreen('victory'); saveRun(); forceRender(); }} />
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
  fallbackWrap: {
    position: 'fixed', inset: 0, display: 'grid', placeItems: 'center',
    background: 'var(--bg)', padding: 16, zIndex: 9998,
  },
  fallbackCard: {
    width: 'min(440px, 92vw)', textAlign: 'center',
    background: 'rgba(20,15,12,0.95)', border: '1px solid rgba(247,147,26,0.4)',
    borderRadius: 16, padding: '28px 24px', color: 'var(--paper)',
    fontFamily: 'var(--font-num)',
  },
  fallbackTitle: { fontFamily: 'var(--font-title)', fontSize: 32, margin: '12px 0 8px', color: 'var(--danger)' },
  fallbackBody: { fontSize: 15, lineHeight: 1.5, color: '#d8c7a6', marginBottom: 20 },
  fallbackBtn: {
    padding: '12px 24px', fontSize: 20, borderRadius: 10,
    background: 'var(--btc)', color: '#1a1411', cursor: 'pointer',
  },
};
