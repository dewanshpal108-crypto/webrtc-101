const userName = 'Rob-' + Math.floor(Math.random() * 100000);
const password = 'x';
document.querySelector('#user-name').innerHTML = userName;

const socket = io({
    auth: {
        userName,
        password,
    },
});

const localVideoEl = document.querySelector('#local-video');

const remoteVideoEl = document.querySelector('#remote-video');

let localStream;
let remoteStream;
let peerConnection;
let didIOffer = false;
let callId = null;
let isCallCreator = false;

const peerConfiguration = {
    iceServers: [
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302',
            ],
        },
    ],
};

function getCallIdFromURL() {
    const pathParts = window.location.pathname.split('/');

    if (pathParts[1] === 'call' && pathParts[2]) {
        return pathParts[2];
    }
    return null;
}

function generateCallId() {
    return crypto.randomUUID();
}

const createCall = async () => {
    callId = generateCallId();
    isCallCreator = true;
    socket.emit(
        'createCall',
        {
            callId,
        },
        async (response) => {
            if (!response.success) {
                console.log('Could not create call:', response.message);

                return;
            }

            console.log('Call created:', callId);

            const callUrl = `${window.location.origin}/call/${callId}`;

            console.log('Share this URL:', callUrl);

            showShareLink(callUrl);

            window.history.pushState({}, '', `/call/${callId}`);

            await fetchUserMedia();

            console.log('Waiting for another person to join...');
        },
    );
};

socket.on('peerJoined', async ({ userName }) => {
    console.log(`${userName} joined the call`);

    if (!isCallCreator) {
        return;
    }

    await createOffer();
});

const createOffer = async () => {
    try {
        await createPeerConnection();

        console.log('Creating WebRTC offer...');

        const offer = await peerConnection.createOffer();

        await peerConnection.setLocalDescription(offer);

        didIOffer = true;

        socket.emit('newOffer', {
            callId,
            offer,
        });

        console.log('Offer sent to server');
    } catch (err) {
        console.log('Error creating offer:', err);
    }
};

const joinCall = async (existingCallId) => {
    callId = existingCallId;

    isCallCreator = false;

    console.log('Joining call:', callId);

    socket.emit('joinCall', callId, async (response) => {
        if (!response.success) {
            alert(response.message);

            return;
        }

        console.log('Successfully joined call');

        await fetchUserMedia();

        console.log('Waiting for offer...');
    });
};

const answerOffer = async (offerObj) => {
    console.log('Received offer:', offerObj);

    await fetchUserMedia();

    await createPeerConnection(offerObj);

    const answer = await peerConnection.createAnswer();

    await peerConnection.setLocalDescription(answer);

    offerObj.answer = answer;

    const offerIceCandidates = await socket.emitWithAck('newAnswer', {
        callId: offerObj.callId,
        answer,
    });

    offerIceCandidates.forEach((candidate) => {
        peerConnection.addIceCandidate(candidate);

        console.log('Added existing ICE candidate');
    });
};

const addAnswer = async (offerObj) => {
    console.log('Received answer:', offerObj);

    if (!peerConnection) {
        console.log('Peer connection does not exist');

        return;
    }

    await peerConnection.setRemoteDescription(offerObj.answer);

    console.log('Remote answer added');
};

const fetchUserMedia = () => {
    return new Promise(async (resolve, reject) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });

            localVideoEl.srcObject = stream;

            localStream = stream;

            resolve();
        } catch (err) {
            console.log('Camera/Microphone error:', err);

            reject(err);
        }
    });
};

const createPeerConnection = (offerObj = null) => {
    return new Promise(async (resolve, reject) => {
        try {
            peerConnection = new RTCPeerConnection(peerConfiguration);

            remoteStream = new MediaStream();

            remoteVideoEl.srcObject = remoteStream;

            localStream.getTracks().forEach((track) => {
                peerConnection.addTrack(track, localStream);
            });

            peerConnection.addEventListener('signalingstatechange', () => {
                console.log('Signaling state:', peerConnection.signalingState);
            });

            peerConnection.addEventListener('icecandidate', (event) => {
                if (!event.candidate) {
                    return;
                }

                socket.emit('sendIceCandidateToSignalingServer', {
                    callId,

                    iceCandidate: event.candidate,
                });
            });

            peerConnection.addEventListener('track', (event) => {
                console.log('Received remote track');

                event.streams[0].getTracks().forEach((track) => {
                    remoteStream.addTrack(track);
                });
            });

            if (offerObj) {
                await peerConnection.setRemoteDescription(offerObj.offer);

                console.log('Remote offer set');
            }

            resolve();
        } catch (err) {
            reject(err);
        }
    });
};

const addNewIceCandidate = (iceCandidate) => {
    if (!peerConnection) {
        console.log('Peer connection does not exist');

        return;
    }

    peerConnection
        .addIceCandidate(iceCandidate)
        .then(() => {
            console.log('ICE candidate added');
        })
        .catch((err) => {
            console.log('Error adding ICE candidate:', err);
        });
};

const showShareLink = (callUrl) => {
    let shareContainer = document.querySelector('#share-container');

    if (!shareContainer) {
        shareContainer = document.createElement('div');

        shareContainer.id = 'share-container';

        document.body.prepend(shareContainer);
    }

    shareContainer.innerHTML = `

        <div>

            <p>
                Share this link with your friend:
            </p>

            <input
                id="share-link"
                type="text"
                value="${callUrl}"
                readonly
            />

            <button id="copy-link">
                Copy Link
            </button>

        </div>

    `;

    document.querySelector('#copy-link').addEventListener('click', async () => {
        await navigator.clipboard.writeText(callUrl);

        document.querySelector('#copy-link').innerText = 'Copied!';

        setTimeout(() => {
            document.querySelector('#copy-link').innerText = 'Copy Link';
        }, 2000);
    });
};

const closePeerConnection = () => {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    remoteVideoEl.srcObject = null;
    remoteStream = null;
};

const cleanupCall = () => {
    closePeerConnection();

    if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        localStream = null;
    }

    localVideoEl.srcObject = null;
    callId = null;
    isCallCreator = false;
    didIOffer = false;

    document.querySelector('#share-container').innerHTML = '';
    window.history.replaceState({}, '', '/');
};

const hangupCall = () => {
    if (callId) {
        socket.emit('hangup', callId);
    }

    cleanupCall();
};

socket.on('peerDisconnected', () => {
    console.log('Peer disconnected');
    closePeerConnection();
    console.log('Waiting for another person...');
});

socket.on('callEnded', cleanupCall);

const existingCallId = getCallIdFromURL();

if (existingCallId) {
    joinCall(existingCallId);
} else {
    console.log('No call ID found');
}

document.querySelector('#call').addEventListener('click', createCall);
document.querySelector('#hangup').addEventListener('click', hangupCall);
