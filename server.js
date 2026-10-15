
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

const rooms = new Map();
const makeId = () => crypto.randomBytes(12).toString("hex");

function send(ws, data) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(room) {
  const state = {
    type: "state",
    code: room.code,
    teams: room.teams,
    players: [...room.players.values()].map(p => ({
      id: p.id,
      name: p.name,
      team: p.team
    })),
    buzzOpen: room.buzzOpen,
    winner: room.winner
  };

  for (const ws of room.connections) {
    send(ws, state);
  }
}

const server = http.createServer((req, res) => {
  const file = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.join(__dirname, "public", file);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      return res.end("File not found");
    }

    const ext = path.extname(filePath);
    const mime = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css"
    };

    res.writeHead(200, {
      "Content-Type": mime[ext] || "text/plain"
    });
    res.end(content);
  });
});

const wss = new WebSocketServer({ server });

wss.on("connection", ws => {
  ws.on("message", raw => {
    let msg;

    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "create") {
      const code = String(
        Math.floor(100000 + Math.random() * 900000)
      );

      const room = {
        code,
        host: ws,
        teams: [
          { name: "Team 1", score: 0 },
          { name: "Team 2", score: 0 },
          { name: "Team 3", score: 0 }
        ],
        players: new Map(),
        connections: new Set([ws]),
        buzzOpen: false,
        winner: null
      };

      rooms.set(code, room);
      ws.room = room;

      send(ws, { type: "created", code });
      broadcast(room);
      return;
    }

    if (msg.type === "join") {
      const room = rooms.get(String(msg.code));
      if (!room) {
        return send(ws, {
          type: "error",
          message: "Room not found"
        });
      }

      if (room.players.size >= 11) {
        return send(ws, {
          type: "error",
          message: "Room is full"
        });
      }

      const id = makeId();
      room.players.set(id, {
        id,
        name: String(msg.name || "Student").slice(0, 32),
        team: room.players.size % 3
      });

      room.connections.add(ws);
      ws.room = room;
      ws.playerId = id;

      send(ws, { type: "joined", id });
      broadcast(room);
      return;
    }

    const room = ws.room;
    if (!room) return;

    if (msg.type === "buzz") {
      if (!room.buzzOpen || room.winner) return;
      if (!ws.playerId) return;

      const player = room.players.get(ws.playerId);
      room.winner = player;
      room.buzzOpen = false;

      broadcast(room);
      return;
    }

    if (ws !== room.host) return;

    if (msg.type === "openBuzzers") {
      room.winner = null;
      room.buzzOpen = true;
    }

    if (msg.type === "closeBuzzers") {
      room.buzzOpen = false;
    }

    if (msg.type === "score") {
      const team = room.teams[msg.team];
      if (team) {
        team.score += Number(msg.points) || 0;
      }
    }

    broadcast(room);
  });

  ws.on("close", () => {
    const room = ws.room;
    if (!room) return;

    room.connections.delete(ws);

    if (ws.playerId) {
      room.players.delete(ws.playerId);
    }

    broadcast(room);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Dental Jeopardy running on port ${PORT}`);
});
