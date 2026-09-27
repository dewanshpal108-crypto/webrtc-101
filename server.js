const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();

const socketio = require('socket.io');

app.use(express.static(__dirname));

const key = fs.readFileSync('cert.key');
const cert = fs.readFileSync('cert.crt');

const server = https.createServer(
    {
        key: key,
        cert: cert,
    },
    app,
);

const io = socketio(server, {
    cors: {
        origin: true,
        methods: ['GET', 'POST'],
    },
});

app.get('/call/:callId', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(8181, () => {
    console.log('Server is running on port 8181');
});

const calls = new Map();

io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    const userName = socket.handshake.auth.userName;
    const password = socket.handshake.auth.password;

    if (password !== 'x') {
        socket.disconnect(true);
        return;
    }

    socket.on('createCall', ({ callId }, ack) => {
        console.log(`Creating call: ${callId}`);

        if (calls.has(callId)) {
            ack({
                success: false,
                message: 'Call already exists',
            });

            return;
        }

        const call = {
            callId,

            offerer: {
                userName,
                socketId: socket.id,
            },

            answerer: null,

            offer: null,

            answer: null,

            offerIceCandidates: [],

            answererIceCandidates: [],
        };

        calls.set(callId, call);

        socket.join(callId);

        console.log(`${userName} created call ${callId}`);

        ack({
            success: true,
            callId,
        });
    });

    socket.on('joinCall', (callId, ack) => {
        console.log(`${userName} wants to join ${callId}`);

        const call = calls.get(callId);

        if (!call) {
            ack({
                success: false,
                message: 'Call not found',
            });

            return;
        }

        if (call.answerer && call.answerer.socketId !== socket.id) {
            ack({
                success: false,
                message: 'Call is already full',
            });

            return;
        }

        call.answerer = {
            userName,
            socketId: socket.id,
        };

        socket.join(callId);

        console.log(`${userName} joined call ${callId}`);

        socket.to(callId).emit('peerJoined', {
            userName,
        });

        ack({
            success: true,
            callId,
        });
    });

    socket.on('newOffer', ({ callId, offer }) => {
        console.log(`New offer received for call ${callId}`);

        const call = calls.get(callId);

        if (!call) {
            console.log('Call not found');
            return;
        }

        call.offer = offer;

        socket.to(callId).emit('newOffer', {
            callId,

            offererUserName: call.offerer.userName,

            offer,

            offerIceCandidates: call.offerIceCandidates,
        });
    });

    socket.on('newAnswer', (offerObj, ackFunction) => {
        const { callId, answer } = offerObj;

        console.log(`New answer received for call ${callId}`);

        const call = calls.get(callId);

        if (!call) {
            console.log('Call not found');
            return;
        }

        call.answer = answer;

        call.answerer = {
            userName,
            socketId: socket.id,
        };

        ackFunction(call.offerIceCandidates);

        io.to(call.offerer.socketId).emit('answerResponse', {
            callId,

            answer,
        });
    });

    socket.on('sendIceCandidateToSignalingServer', (iceCandidateObj) => {
        const { callId, iceCandidate } = iceCandidateObj;

        const call = calls.get(callId);

        if (!call) {
            console.log('Call not found');
            return;
        }

        if (call.offerer && call.offerer.socketId === socket.id) {
            call.offerIceCandidates.push(iceCandidate);

            if (call.answerer) {
                io.to(call.answerer.socketId).emit(
                    'receivedIceCandidateFromServer',
                    iceCandidate,
                );
            }
        } else if (call.answerer && call.answerer.socketId === socket.id) {
            call.answererIceCandidates.push(iceCandidate);

            io.to(call.offerer.socketId).emit(
                'receivedIceCandidateFromServer',
                iceCandidate,
            );
        }
    });

    socket.on('hangup', (callId) => {
        const call = calls.get(callId);

        if (!call) {
            return;
        }

        if (call.offerer.socketId === socket.id) {
            if (call.answerer) {
                io.to(call.answerer.socketId).emit('callEnded');
            }

            calls.delete(callId);
            socket.leave(callId);
            return;
        }

        if (call.answerer && call.answerer.socketId === socket.id) {
            io.to(call.offerer.socketId).emit('peerDisconnected');

            call.answerer = null;
            call.answer = null;
            call.answererIceCandidates = [];
            socket.leave(callId);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);

        for (const [callId, call] of calls) {
            let shouldDeleteCall = false;

            if (call.offerer && call.offerer.socketId === socket.id) {
                console.log(`Offerer left call ${callId}`);

                shouldDeleteCall = true;
            } else if (call.answerer && call.answerer.socketId === socket.id) {
                console.log(`Answerer left call ${callId}`);

                io.to(call.offerer.socketId).emit('peerDisconnected');

                call.answerer = null;

                call.answer = null;

                call.answererIceCandidates = [];
            }

            if (shouldDeleteCall) {
                io.to(callId).emit('peerDisconnected');

                calls.delete(callId);

                console.log(`Call ${callId} deleted`);
            }
        }
    });
});
