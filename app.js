const socket = io();

let username = "";
let localStream = null;
let peerConnection = null;

let currentCallId = null;
let incomingOffer = null;

let callState = "idle";

const loginScreen =
    document.getElementById("loginScreen");

const appScreen =
    document.getElementById("appScreen");

const usernameInput =
    document.getElementById("username");

const joinButton =
    document.getElementById("joinButton");

const loginError =
    document.getElementById("loginError");

const myUsername =
    document.getElementById("myUsername");

const usersList =
    document.getElementById("usersList");

const usersCount =
    document.getElementById("usersCount");

const noUsers =
    document.getElementById("noUsers");

const callPanel =
    document.getElementById("callPanel");

const callName =
    document.getElementById("callName");

const callStatus =
    document.getElementById("callStatus");

const hangUpButton =
    document.getElementById("hangUpButton");

const incomingPanel =
    document.getElementById("incomingPanel");

const incomingName =
    document.getElementById("incomingName");

const acceptButton =
    document.getElementById("acceptButton");

const rejectButton =
    document.getElementById("rejectButton");

const remoteAudio =
    document.getElementById("remoteAudio");


/* ==========================================
   CONNEXION
========================================== */

joinButton.addEventListener("click", join);

usernameInput.addEventListener("keydown", (event) => {

    if (event.key === "Enter") {
        join();
    }

});


async function join() {

    loginError.textContent = "";

    const name =
        usernameInput.value.trim();

    if (!name) {

        loginError.textContent =
            "Entre ton prénom.";

        return;
    }


    try {

        /*
         * Demande l'accès au microphone.
         */
        localStream =
            await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });


        username = name;

        myUsername.textContent =
            username;


        loginScreen.classList.add("hidden");

        appScreen.classList.remove("hidden");


        socket.emit(
            "join",
            username
        );


    } catch (error) {

        console.error(error);

        loginError.textContent =
            "L'accès au microphone a été refusé. " +
            "Autorise le microphone dans ton navigateur.";

    }

}


/* ==========================================
   UTILISATEURS
========================================== */

socket.on("users", (users) => {

    usersList.innerHTML = "";

    const otherUsers =
        users.filter(
            user => user.id !== socket.id
        );


    usersCount.textContent =
        `${otherUsers.length} ${
            otherUsers.length > 1
                ? "personnes"
                : "personne"
        }`;


    if (otherUsers.length === 0) {

        noUsers.classList.remove("hidden");

        return;
    }


    noUsers.classList.add("hidden");


    otherUsers.forEach(user => {

        const element =
            document.createElement("div");

        element.className = "user";


        const left =
            document.createElement("div");

        left.className = "user-left";


        const avatar =
            document.createElement("div");

        avatar.className = "avatar";

        avatar.textContent = "👤";


        const info =
            document.createElement("div");


        const name =
            document.createElement("div");

        name.className = "username";

        name.textContent =
            user.username;


        const online =
            document.createElement("div");

        online.className = "online-text";

        online.textContent =
            "● En ligne";


        info.appendChild(name);
        info.appendChild(online);


        left.appendChild(avatar);
        left.appendChild(info);


        const button =
            document.createElement("button");

        button.className =
            "call-button";

        button.textContent =
            "📞 Appeler";


        button.addEventListener(
            "click",
            () => callUser(user.id, user.username)
        );


        element.appendChild(left);
        element.appendChild(button);


        usersList.appendChild(element);

    });

});


/* ==========================================
   CRÉER UNE CONNEXION WEBRTC
========================================== */

function createPeerConnection(targetId) {

    /*
     * Serveurs STUN.
     *
     * Ils permettent aux deux appareils
     * de découvrir comment communiquer.
     */
    peerConnection =
        new RTCPeerConnection({

            iceServers: [
                {
                    urls:
                        "stun:stun.l.google.com:19302"
                }
            ]

        });


    /*
     * Ajouter notre microphone
     */
    localStream
        .getTracks()
        .forEach(track => {

            peerConnection.addTrack(
                track,
                localStream
            );

        });


    /*
     * Recevoir le microphone distant
     */
    peerConnection.ontrack =
        (event) => {

            remoteAudio.srcObject =
                event.streams[0];

        };


    /*
     * Envoyer les candidats ICE
     */
    peerConnection.onicecandidate =
        (event) => {

            if (!event.candidate) {
                return;
            }


            socket.emit(
                "ice-candidate",
                {
                    targetId,
                    candidate: event.candidate
                }
            );

        };


    /*
     * Surveiller la connexion
     */
    peerConnection.onconnectionstatechange =
        () => {

            console.log(
                "WebRTC :",
                peerConnection.connectionState
            );


            if (
                peerConnection.connectionState ===
                "connected"
            ) {

                callState = "connected";

                callStatus.textContent =
                    "🟢 Appel connecté";

            }


            if (
                peerConnection.connectionState ===
                    "disconnected" ||

                peerConnection.connectionState ===
                    "failed" ||

                peerConnection.connectionState ===
                    "closed"
            ) {

                endCall(false);

            }

        };

}


/* ==========================================
   APPELER QUELQU'UN
========================================== */

async function callUser(
    targetId,
    targetName
) {

    if (callState !== "idle") {
        return;
    }


    currentCallId =
        targetId;

    callState =
        "calling";


    createPeerConnection(
        targetId
    );


    try {

        const offer =
            await peerConnection.createOffer();


        await peerConnection.setLocalDescription(
            offer
        );


        socket.emit(
            "call-user",
            {
                targetId,
                offer
            }
        );


        callName.textContent =
            targetName;

        callStatus.textContent =
            "📞 Appel en cours...";


        callPanel.classList.remove(
            "hidden"
        );


    } catch (error) {

        console.error(error);

        endCall(false);

    }

}


/* ==========================================
   APPEL ENTRANT
========================================== */

socket.on(
    "incoming-call",
    (data) => {

        /*
         * Si on est déjà dans un appel,
         * on refuse automatiquement.
         */
        if (callState !== "idle") {

            socket.emit(
                "reject-call",
                {
                    targetId:
                        data.callerId
                }
            );

            return;
        }


        currentCallId =
            data.callerId;

        incomingOffer =
            data.offer;

        callState =
            "incoming";


        incomingName.textContent =
            `${data.callerName} t'appelle`;


        incomingPanel.classList.remove(
            "hidden"
        );

    }
);


/* ==========================================
   ACCEPTER
========================================== */

acceptButton.addEventListener(
    "click",
    async () => {

        if (
            !incomingOffer ||
            !currentCallId
        ) {
            return;
        }


        incomingPanel.classList.add(
            "hidden"
        );


        callState =
            "connected";


        createPeerConnection(
            currentCallId
        );


        try {

            await peerConnection.setRemoteDescription(
                new RTCSessionDescription(
                    incomingOffer
                )
            );


            const answer =
                await peerConnection.createAnswer();


            await peerConnection.setLocalDescription(
                answer
            );


            socket.emit(
                "answer-call",
                {
                    callerId:
                        currentCallId,

                    answer
                }
            );


            callName.textContent =
                "Appel";


            callStatus.textContent =
                "🟢 Connexion...";


            callPanel.classList.remove(
                "hidden"
            );


        } catch (error) {

            console.error(error);

            endCall(false);

        }

    }
);


/* ==========================================
   REFUSER
========================================== */

rejectButton.addEventListener(
    "click",
    () => {

        if (currentCallId) {

            socket.emit(
                "reject-call",
                {
                    targetId:
                        currentCallId
                }
            );

        }


        incomingPanel.classList.add(
            "hidden"
        );


        currentCallId =
            null;

        incomingOffer =
            null;

        callState =
            "idle";

    }
);


/* ==========================================
   APPEL ACCEPTÉ
========================================== */

socket.on(
    "call-answered",
    async (data) => {

        if (!peerConnection) {
            return;
        }


        try {

            await peerConnection.setRemoteDescription(
                new RTCSessionDescription(
                    data.answer
                )
            );


            callState =
                "connected";


            callStatus.textContent =
                "🟢 Connexion...";

        } catch (error) {

            console.error(error);

        }

    }
);


/* ==========================================
   ICE
========================================== */

socket.on(
    "ice-candidate",
    async (data) => {

        if (!peerConnection) {
            return;
        }


        try {

            await peerConnection.addIceCandidate(
                new RTCIceCandidate(
                    data.candidate
                )
            );

        } catch (error) {

            console.error(
                "Erreur ICE :",
                error
            );

        }

    }
);


/* ==========================================
   REFUS D'APPEL
========================================== */

socket.on(
    "call-rejected",
    () => {

        alert(
            "L'appel a été refusé."
        );

        endCall(false);

    }
);


/* ==========================================
   RACCROCHER
========================================== */

hangUpButton.addEventListener(
    "click",
    () => {

        if (currentCallId) {

            socket.emit(
                "hang-up",
                {
                    targetId:
                        currentCallId
                }
            );

        }


        endCall(false);

    }
);


/* ==========================================
   APPEL TERMINÉ
========================================== */

socket.on(
    "call-ended",
    () => {

        alert(
            "L'appel est terminé."
        );

        endCall(false);

    }
);


/* ==========================================
   FIN D'APPEL
========================================== */

function endCall(
    notify = true
) {

    if (peerConnection) {

        peerConnection.ontrack = null;
        peerConnection.onicecandidate = null;

        peerConnection.close();

        peerConnection = null;

    }


    callPanel.classList.add(
        "hidden"
    );


    incomingPanel.classList.add(
        "hidden"
    );


    currentCallId =
        null;

    incomingOffer =
        null;

    callState =
        "idle";


    if (remoteAudio) {

        remoteAudio.srcObject =
            null;

    }

}


/* ==========================================
   FERMETURE DE LA PAGE
========================================== */

window.addEventListener(
    "beforeunload",
    () => {

        if (localStream) {

            localStream
                .getTracks()
                .forEach(
                    track => track.stop()
                );

        }

    }
);