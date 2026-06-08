import { useEffect, useRef, useState, useReducer } from 'react';
import { gameState, tick, resetGame, CONFIG, DEV_MODE } from './game/gameState.js';
import { ROUTE, BIOMES } from './data/route.js';
import { ParallaxScene } from './game/ParallaxScene.js';
import { audio } from './game/AudioManager.js';
import StartScreen from './components/StartScreen.jsx';
import HUD from './components/HUD.jsx';
import CityStop from './components/CityStop.jsx';
import EventCard from './components/EventCard.jsx';
import GameOver from './components/GameOver.jsx';
import Victory from './components/Victory.jsx';
import WaveShooterModal from './components/WaveShooterModal.jsx';
import RouteMap from './components/RouteMap.jsx';
import ArrivalSequence from './components/ArrivalSequence.jsx';
import { getEvent } from './ai/eventEngine.js';
import { applyEffects } from './game/gameState.js';

export default function App() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const [, forceRender] = useReducer((n) => n + 1, 0);
  const [showMap, setShowMap] = useState(false);
  const [eventData, setEventData] = useState(null);
  const eventDataRef = useRef(null);
  const [shooter, setShooter] = useState(null); // null | { source }

  // ---- mount the single Three.js scene + run the rAF loop ----------------
  useEffect(() => {
    const scene = new ParallaxScene(canvasRef.current);
    sceneRef.current = scene;
    if (DEV_MODE) { window.gameState = gameState; window.__fireEvent = fireEvent; } // dev-only debug handles

    let raf, last = performance.now();
    let eventTimer = scheduleNextEvent();

    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); // clamp big tab-switch gaps
      last = now;

      tick(dt);
      handleCityStops();
      if (gameState.screen === 'playing' && !gameState.paused) {
        eventTimer -= dt * 1000;
        if (eventTimer <= 0) { fireEvent(); eventTimer = scheduleNextEvent(); }
      }
      handleArrival();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- orchestration helpers --------------------------------------------
  function scheduleNextEvent() {
    return CONFIG.EVENT_MIN_MS + Math.random() * (CONFIG.EVENT_MAX_MS - CONFIG.EVENT_MIN_MS);
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

  const resolveEvent = (effects, ev) => {
    applyEffects(effects);
    gameState.recentEventTitles.push(ev.headline);
    if (gameState.recentEventTitles.length > 10) gameState.recentEventTitles.shift();
    gameState.eventsSurvived++;
    eventDataRef.current = null;
    setEventData(null);
    gameState.paused = false;
  };

  const fightEvent = () => {
    // "Stand your ground" opens the WaveShooter instead of applying effects.
    gameState.recentEventTitles.push(eventDataRef.current?.headline);
    if (gameState.recentEventTitles.length > 10) gameState.recentEventTitles.shift();
    gameState.eventsSurvived++;
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
        // (San Salvador, which is handled by the arrival sequence).
        if (i < ROUTE.length - 1) {
          gameState.paused = true;
          gameState.cityStopIndex = i;
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
  const handleStart = (name, difficulty) => {
    audio.init();
    audio.startEngine();
    resetGame(name, difficulty);
    gameState.lastStopIndex = 0; // already at LA (index 0)
    gameState.cityStopIndex = -1;
    eventDataRef.current = null;
    setEventData(null);
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
    setShooter(null);
    gameState.paused = false;
    forceRender();
  };

  const togglePause = () => { gameState.paused = !gameState.paused; forceRender(); };
  const toggleMap = () => { setShowMap((v) => !v); };

  const restart = () => {
    resetGame(gameState.playerName, gameState.difficulty);
    gameState.lastStopIndex = 0;
    gameState.cityStopIndex = -1;
    eventDataRef.current = null;
    setEventData(null);
    setShooter(null);
    forceRender();
  };
  const toMenu = () => { gameState.screen = 'start'; setShooter(null); forceRender(); };

  // ---- render ------------------------------------------------------------
  const s = gameState;
  return (
    <>
      <canvas ref={canvasRef} style={styles.canvas} />

      {s.screen === 'start' && <StartScreen onStart={handleStart} />}

      {s.screen === 'playing' && (
        <>
          <HUD onToggleMap={toggleMap} onTogglePause={togglePause} />
          {s.cityStopIndex >= 0 && (
            <CityStop index={s.cityStopIndex} onContinue={leaveCityStop} />
          )}
          {eventData && !shooter && (
            <EventCard event={eventData} onChoose={resolveEvent} onFight={fightEvent} />
          )}
          {shooter && (
            <WaveShooterModal biome={gameState.biome} onDone={endShooter} />
          )}
          {showMap && <RouteMap onClose={() => setShowMap(false)} />}
          {s.paused && s.cityStopIndex < 0 && !eventData && (
            <div style={styles.pauseOverlay} onClick={togglePause}>
              <div style={{ fontFamily: 'var(--font-title)', fontSize: 48 }}>PAUSED</div>
              <div style={{ fontFamily: 'var(--font-num)', fontSize: 14, opacity: 0.8 }}>click to resume</div>
            </div>
          )}
        </>
      )}

      {s.screen === 'gameover' && <GameOver onRestart={restart} onMenu={toMenu} />}

      {s.screen === 'arrival' && (
        <ArrivalSequence onDone={() => { gameState.screen = 'victory'; forceRender(); }} />
      )}

      {s.screen === 'victory' && <Victory onRestart={restart} onMenu={toMenu} />}
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
