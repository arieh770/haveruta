const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

// Servir le dossier public
app.use(express.static(path.join(__dirname, "public")));

// Utilisateurs connectés
const users = new Map();

io.on("connection", (socket) => {
    console.log("Connexion :", socket.id);

    // Connexion d'un utilisateur
    socket.on("join", (username) => {
        const cleanUsername = String(username)
            .trim()
            .slice(0, 20);

        if (!cleanUsername) return;

        users.set(socket.id, cleanUsername);

        console.log(`${cleanUsername} est connecté`);

        sendUsers();
    });

    // Demande d'appel
    socket.on("call-user", ({ targetId, offer }) => {
        if (!users.has(socket.id)) return;
        if (!users.has(targetId)) return;

        io.to(targetId).emit("incoming-call", {
            callerId: socket.id,
            callerName: users.get(socket.id),
            offer
        });
    });

    // Réponse à l'appel
    socket.on("answer-call", ({ callerId, answer }) => {
        if (!users.has(socket.id)) return;
        if (!users.has(callerId)) return;

        io.to(callerId).emit("call-answered", {
            answer
        });
    });

    // Informations ICE WebRTC
    socket.on("ice-candidate", ({ targetId, candidate }) => {
        if (!users.has(socket.id)) return;
        if (!users.has(targetId)) return;

        io.to(targetId).emit("ice-candidate", {
            senderId: socket.id,
            candidate
        });
    });

    // Refus
    socket.on("reject-call", ({ targetId }) => {
        if (!users.has(socket.id)) return;
        if (!users.has(targetId)) return;

        io.to(targetId).emit("call-rejected");
    });

    // Raccrocher
    socket.on("hang-up", ({ targetId }) => {
        if (!users.has(socket.id)) return;
        if (!users.has(targetId)) return;

        io.to(targetId).emit("call-ended");
    });

    // Déconnexion
    socket.on("disconnect", () => {
        const username = users.get(socket.id);

        console.log(
            `${username || "Utilisateur"} est déconnecté`
        );

        users.delete(socket.id);

        sendUsers();
    });

    function sendUsers() {
        const userList = Array.from(users.entries()).map(
            ([id, username]) => ({
                id,
                username
            })
        );

        io.emit("users", userList);
    }
});

server.listen(PORT, () => {
    console.log("");
    console.log("=================================");
    console.log("   SERVEUR D'APPEL AUDIO");
    console.log("=================================");
    console.log("");
    console.log(`Site : http://localhost:${PORT}`);
    console.log("");
});