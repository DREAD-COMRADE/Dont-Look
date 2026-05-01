import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GamePhase, PlayerState, Difficulty, WatcherState, PlayerData, WatcherData } from "./src/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);

// Exit zone position (place the exit arch in Game.tsx at this same position)
const EXIT_X = 0;
const EXIT_Z = -9;
const EXIT_RADIUS = 1.5;

// Ritual zone at world origin
const RITUAL_RADIUS = 3.0;

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
  });

  const gameSettings = {
    difficulty: Difficulty.MEDIUM,
    activeWatcherCount: 0,
    gamePhase: GamePhase.LOBBY,
    migrationCommitted: false,
    migrationTimer: 0,       // seconds elapsed since collapse
    migrationComplete: false, // watcher fully arrived in Mystery Realm
    flickerBudget: 3,
    visionThreshold: 0.65,
    watcherSpeed: 3.0,
    captureRadius: 0.85,
    secretPathRevealed: false,
  };

  const players: Map<string, PlayerData> = new Map();
  const watchers: Map<string, WatcherData> = new Map();
  let ritualActivators: Set<string> = new Set();
  let ritualTimer: number = 0;
  let ritualInProgress: boolean = false;

  io.on("connection", (socket) => {
    socket.on("join", (name: string) => {
      const player: PlayerData = {
        id: socket.id,
        name: name || `Player ${socket.id.slice(0, 4)}`,
        state: PlayerState.ALIVE,
        position: [0, 1, -5],
        rotation: [0, 0, 0],
        camForward: [0, 0, -1],
        camPosition: [0, 1.7, -5],
        respawnGrace: true,
        flickerCooldown: 0,
        isReady: false,
      };
      players.set(socket.id, player);
      setTimeout(() => {
        const p = players.get(socket.id);
        if (p) p.respawnGrace = false;
      }, 3000);
      io.emit("player_list", Array.from(players.values()));
      socket.emit("game_settings", gameSettings);
    });

    socket.on("ready_toggle", () => {
      const player = players.get(socket.id);
      if (player) {
        player.isReady = !player.isReady;
        io.emit("player_list", Array.from(players.values()));
      }
    });

    socket.on("start_game", () => {
      if (socket.id === Array.from(players.keys())[0]) {
        let count = 0;
        if (gameSettings.difficulty === Difficulty.EASY) {
          count = 2; gameSettings.watcherSpeed = 2.5;
        } else if (gameSettings.difficulty === Difficulty.MEDIUM) {
          count = Math.random() < 0.5 ? 3 : 4; gameSettings.watcherSpeed = 3.0;
        } else {
          count = Math.random() < 0.5 ? 5 : 6; gameSettings.watcherSpeed = 3.8;
        }
        gameSettings.activeWatcherCount = count;
        gameSettings.gamePhase = GamePhase.NORMAL;
        gameSettings.migrationCommitted = false;
        gameSettings.migrationTimer = 0;
        gameSettings.migrationComplete = false;
        gameSettings.secretPathRevealed = false;

        // Reset all players to alive at spawn
        players.forEach(p => {
          p.state = PlayerState.ALIVE;
          p.position = [0, 1, -5];
          p.respawnGrace = true;
          p.flickerCooldown = 0;
          p.isReady = false;
          setTimeout(() => { p.respawnGrace = false; }, 3000);
        });

        watchers.clear();
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          const id = `watcher_${i}`;
          watchers.set(id, {
            id,
            position: [Math.cos(angle) * 15, 0, Math.sin(angle) * 15],
            state: WatcherState.IDLE,
            distanceClosedTimer: 0,
            lastDistToTarget: Infinity,
            movingFramesCount: 0,
          });
        }

        ritualActivators.clear();
        ritualTimer = 0;
        ritualInProgress = false;

        io.emit("game_start", { gameSettings, watchers: Array.from(watchers.values()) });
      }
    });

    socket.on("update_input", (data: any) => {
      const player = players.get(socket.id);
      if (player) {
        player.position = data.position;
        player.rotation = data.rotation;
        player.camForward = data.camForward;
        player.camPosition = data.camPosition;
      }
    });

    socket.on("ritual_interact", (active: boolean) => {
      const player = players.get(socket.id);
      if (!player || player.state !== PlayerState.ALIVE) return;
      if (active) {
        ritualActivators.add(socket.id);
      } else {
        ritualActivators.delete(socket.id);
      }
    });

    // Lost players can flicker lights once per cooldown
    socket.on("request_flicker", () => {
      const player = players.get(socket.id);
      if (
        player &&
        player.state === PlayerState.LOST &&
        gameSettings.flickerBudget > 0 &&
        player.flickerCooldown <= 0
      ) {
        gameSettings.flickerBudget--;
        player.flickerCooldown = 60;
        io.emit("execute_flicker");
      }
    });

    // Secret path — single use betrayal
    socket.on("use_secret_path", () => {
      const player = players.get(socket.id);
      if (
        !player ||
        player.state !== PlayerState.IN_REALM ||
        gameSettings.gamePhase !== GamePhase.FINAL_ACT ||
        !gameSettings.secretPathRevealed
      ) return;

      // Single-use: seal the path immediately
      gameSettings.secretPathRevealed = false;

      const roll = Math.random();
      if (roll < 0.5) {
        // Selfish escape — betrayer survives, everyone else lost
        player.state = PlayerState.ESCAPED;
        players.forEach(p => {
          if (p.id !== player.id && p.state !== PlayerState.ESCAPED) {
            p.state = PlayerState.LOST;
          }
        });
        io.emit("ritual_event", `${player.name} ESCAPED ALONE. ALL OTHERS CONSUMED.`);
        io.emit("secret_path_outcome", { betrayer: player.id, outcome: "selfish" });
      } else {
        // Twist — betrayer dies, everyone else freed
        player.state = PlayerState.LOST;
        players.forEach(p => {
          if (p.id !== player.id && (p.state === PlayerState.IN_REALM || p.state === PlayerState.IN_HARSH)) {
            p.state = PlayerState.ALIVE;
            p.position = [0, 1, -5];
            p.respawnGrace = true;
            setTimeout(() => { p.respawnGrace = false; }, 3000);
          }
        });
        io.emit("ritual_event", `${player.name} FELL AT THE THRESHOLD. THE WAY OPENED FOR ALL OTHERS.`);
        io.emit("secret_path_outcome", { betrayer: player.id, outcome: "twist" });
        gameSettings.gamePhase = GamePhase.NORMAL;
      }
    });

    socket.on("disconnect", () => {
      players.delete(socket.id);
      ritualActivators.delete(socket.id);
      io.emit("player_list", Array.from(players.values()));
    });
  });

  // Game loop ~60 ticks/sec
  setInterval(() => {
    if (
      gameSettings.gamePhase === GamePhase.NORMAL ||
      gameSettings.gamePhase === GamePhase.FINAL_ACT
    ) {
      updateFlickerCooldowns();
      updateWatchers();
      updateRituals();
      checkCaptures();
      checkExitZone();
      checkWinLoss();
      io.emit("state_sync", {
        players: Array.from(players.values()),
        watchers: Array.from(watchers.values()),
        gameSettings,
      });
    }
  }, 16);

  function updateFlickerCooldowns() {
    players.forEach(p => {
      if (p.flickerCooldown > 0) p.flickerCooldown--;
    });
  }

  function isPlayerLookingAtWatcher(player: PlayerData, watcher: WatcherData): boolean {
    const dx = watcher.position[0] - player.camPosition[0];
    const dy = watcher.position[1] - player.camPosition[1];
    const dz = watcher.position[2] - player.camPosition[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist > 50) return false;
    const dot =
      player.camForward[0] * (dx / dist) +
      player.camForward[1] * (dy / dist) +
      player.camForward[2] * (dz / dist);
    return dot > gameSettings.visionThreshold;
  }

  function updateWatchers() {
    const aliveTargets = Array.from(players.values()).filter(
      p => p.state === PlayerState.ALIVE
    );

    // In Final Act, watchers also hunt Mystery Realm players (after migration completes)
    const realmTargets = gameSettings.migrationComplete
      ? Array.from(players.values()).filter(p => p.state === PlayerState.IN_REALM)
      : [];

    const allTargets = [...aliveTargets, ...realmTargets];

    watchers.forEach(watcher => {
      let isObserved = false;
      // Only alive players can freeze the watcher by looking
      aliveTargets.forEach(player => {
        if (isPlayerLookingAtWatcher(player, watcher)) {
          isObserved = true;
        }
      });

      if (isObserved) {
        watcher.state = WatcherState.IDLE;
        watcher.movingFramesCount = 0;
        return;
      }

      if (allTargets.length === 0) return;

      watcher.state = WatcherState.MOVING;
      watcher.movingFramesCount++;

      // Find nearest target
      let nearest: PlayerData | null = null;
      let minDist = Infinity;
      allTargets.forEach(p => {
        const d = Math.sqrt(
          (p.position[0] - watcher.position[0]) ** 2 +
          (p.position[2] - watcher.position[2]) ** 2
        );
        if (d < minDist) { minDist = d; nearest = p; }
      });

      if (!nearest) return;

      // Geometry stall fallback: if watcher hasn't closed distance in 2s (~120 ticks), strafe
      const closedDist = watcher.lastDistToTarget - minDist;
      watcher.distanceClosedTimer = closedDist > 0.05
        ? 0
        : watcher.distanceClosedTimer + 1;

      watcher.lastDistToTarget = minDist;

      const speed = gameSettings.watcherSpeed * 0.016;
      let dx = nearest.position[0] - watcher.position[0];
      let dz = nearest.position[2] - watcher.position[2];
      const len = Math.sqrt(dx * dx + dz * dz);

      if (len > 0.1) {
        if (watcher.distanceClosedTimer > 120) {
          // Strafe 90 degrees to get unstuck
          watcher.position[0] += (-dz / len) * speed;
          watcher.position[2] += (dx / len) * speed;
          watcher.distanceClosedTimer = 0;
        } else {
          watcher.position[0] += (dx / len) * speed;
          watcher.position[2] += (dz / len) * speed;
        }
      }
    });

    // Final Act: migrate watcher after 90s
    if (gameSettings.gamePhase === GamePhase.FINAL_ACT && gameSettings.migrationCommitted) {
      gameSettings.migrationTimer += 0.016;
      if (gameSettings.migrationTimer >= 90 && !gameSettings.migrationComplete) {
        gameSettings.migrationComplete = true;
        io.emit("migration_complete");
      }
    }
  }

  function updateRituals() {
    // Gate: ritual only active when someone is Lost in Mystery Realm or Harsh Dimension
    const lostInRealm = Array.from(players.values()).some(
      p => p.state === PlayerState.IN_REALM || p.state === PlayerState.IN_HARSH
    );

    if (!lostInRealm) {
      ritualTimer = 0;
      ritualInProgress = false;
      ritualActivators.clear();
      return;
    }

    // Find alive players inside ritual zone who are pressing E
    const activatorsInZone = Array.from(players.values()).filter(p =>
      p.state === PlayerState.ALIVE &&
      ritualActivators.has(p.id) &&
      Math.sqrt(p.position[0] ** 2 + p.position[2] ** 2) < RITUAL_RADIUS
    );

    // Players in zone but not pressing E — they're just present, not abandoning yet
    const presentInZone = Array.from(players.values()).filter(p =>
      p.state === PlayerState.ALIVE &&
      Math.sqrt(p.position[0] ** 2 + p.position[2] ** 2) < RITUAL_RADIUS
    );

    if (activatorsInZone.length >= 1) {
      ritualInProgress = true;
      ritualTimer += 0.016;

      io.emit("ritual_progress", ritualTimer / 3.0);

      if (ritualTimer >= 3.0) {
        executeRitual(activatorsInZone[0]);
        ritualTimer = 0;
        ritualInProgress = false;
        ritualActivators.clear();
      }
    } else if (ritualInProgress && presentInZone.length === 0) {
      // Everyone left mid-ritual — consequence
      ritualInProgress = false;
      const wasActivating = Array.from(players.values()).filter(p =>
        ritualActivators.has(p.id)
      );
      wasActivating.forEach(p => {
        p.state = PlayerState.IN_REALM;
        io.emit("player_captured", p.id);
      });
      io.emit("ritual_event", "RITUAL ABANDONED. THE VOID TAKES ITS DUES.");
      ritualTimer = 0;
      ritualActivators.clear();
    } else {
      ritualTimer = 0;
      ritualInProgress = false;
    }
  }

  function executeRitual(sacrificer: PlayerData) {
    const targets = Array.from(players.values()).filter(
      p => p.state === PlayerState.IN_REALM || p.state === PlayerState.IN_HARSH
    );
    if (targets.length === 0) return;
    const target = targets[Math.floor(Math.random() * targets.length)];
    const roll = Math.random();

    if (roll < 0.65) {
      // TRADE: sacrificer goes in, lost player comes out
      target.state = PlayerState.ALIVE;
      target.position = [2, 1, -3];
      target.respawnGrace = true;
      setTimeout(() => { target.respawnGrace = false; }, 2500);
      sacrificer.state = PlayerState.IN_REALM;
      io.emit("ritual_event", `TRADE: ${target.name} freed. ${sacrificer.name} taken.`);
    } else if (roll < 0.85) {
      // SHARED: both enter Mystery Realm (lit version — handled client-side by outcome flag)
      target.state = PlayerState.IN_REALM;
      sacrificer.state = PlayerState.IN_REALM;
      io.emit("ritual_event", "SHARED FATE: Both enter the Realm. Find the light.");
      io.emit("realm_shared_light", [target.id, sacrificer.id]);
    } else {
      // TOTAL LOSS: both go to Harsh Dimension
      target.state = PlayerState.IN_HARSH;
      sacrificer.state = PlayerState.IN_HARSH;
      io.emit("ritual_event", "TOTAL LOSS: Both consumed by the Void.");
    }
  }

  function checkCaptures() {
    watchers.forEach(watcher => {
      // Require watcher to have been moving for at least 3 frames (prevents grace-period captures)
      if (watcher.state !== WatcherState.MOVING || watcher.movingFramesCount < 3) return;

      players.forEach(player => {
        if (player.state !== PlayerState.ALIVE || player.respawnGrace) return;
        const d = Math.sqrt(
          (player.position[0] - watcher.position[0]) ** 2 +
          (player.position[2] - watcher.position[2]) ** 2
        );
        if (d < gameSettings.captureRadius) {
          player.state = PlayerState.IN_REALM;
          player.respawnGrace = true;
          setTimeout(() => { player.respawnGrace = false; }, 2500);
          io.emit("player_captured", player.id);
        }
      });
    });
  }

  function checkExitZone() {
    // Exit only works in NORMAL phase when all players who haven't escaped are alive
    if (gameSettings.gamePhase !== GamePhase.NORMAL) return;

    const anyStillTrapped = Array.from(players.values()).some(
      p => p.state === PlayerState.IN_REALM || p.state === PlayerState.IN_HARSH
    );

    // Exit gate locked while anyone is in Mystery Realm / Harsh Dimension
    if (anyStillTrapped) return;

    players.forEach(player => {
      if (player.state !== PlayerState.ALIVE) return;
      const d = Math.sqrt(
        (player.position[0] - EXIT_X) ** 2 +
        (player.position[2] - EXIT_Z) ** 2
      );
      if (d < EXIT_RADIUS) {
        player.state = PlayerState.ESCAPED;
        io.emit("player_escaped", player.id);
        io.emit("ritual_event", `${player.name} escaped.`);
      }
    });
  }

  function checkWinLoss() {
    const stats = { alive: 0, inRealm: 0, lost: 0, escaped: 0 };
    players.forEach(p => {
      if (p.state === PlayerState.ALIVE) stats.alive++;
      if (p.state === PlayerState.IN_REALM || p.state === PlayerState.IN_HARSH) stats.inRealm++;
      if (p.state === PlayerState.LOST) stats.lost++;
      if (p.state === PlayerState.ESCAPED) stats.escaped++;
    });

    // Trigger The Collapse: last alive player gone, people still in Realm
    if (
      stats.alive === 0 &&
      stats.inRealm > 0 &&
      !gameSettings.migrationCommitted &&
      gameSettings.gamePhase === GamePhase.NORMAL
    ) {
      gameSettings.gamePhase = GamePhase.FINAL_ACT;
      gameSettings.migrationCommitted = true;
      gameSettings.migrationTimer = 0;
      gameSettings.secretPathRevealed = true;
      io.emit("collapse_event", { migrationSeconds: 90 });
      io.emit("ritual_event", "THE VOID CONSUMES THE WORLD. THE PATH REVEALS ITSELF.");
    }

    // Total loss: no alive, no escaped, all lost
    if (stats.alive === 0 && stats.inRealm === 0 && stats.escaped === 0 && stats.lost > 0) {
      gameSettings.gamePhase = GamePhase.ENDED;
      io.emit("game_ended", { win: false, escaped: 0 });
    }

    // All players accounted for and at least one escaped
    if (stats.alive === 0 && stats.inRealm === 0 && stats.escaped > 0 && stats.lost === 0) {
      gameSettings.gamePhase = GamePhase.ENDED;
      io.emit("game_ended", { win: true, escaped: stats.escaped });
    }

    // Mixed end: some escaped, rest lost, none remaining active
    if (
      stats.alive === 0 &&
      stats.inRealm === 0 &&
      stats.escaped > 0 &&
      stats.lost > 0
    ) {
      gameSettings.gamePhase = GamePhase.ENDED;
      io.emit("game_ended", { win: true, escaped: stats.escaped });
    }
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // In production: server.js is in dist/, frontend assets are in dist/public/
    const distPath = path.resolve(__dirname, "public");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
