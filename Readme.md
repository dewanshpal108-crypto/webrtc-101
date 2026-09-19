# WebRTC Signaling, SDP, STUN & ICE --- Simple Guide

This README explains the complete WebRTC connection process in simple
language.

We will use a simple example:

> **CLIENT 1 (Alice) wants to call CLIENT 2 (Bob) using WebRTC.**

The goal is to understand:

-   `getUserMedia()`
-   `RTCPeerConnection`
-   STUN servers
-   ICE candidates
-   SDP
-   Offer / Answer
-   `setLocalDescription()`
-   `setRemoteDescription()`
-   Signaling with Socket.IO
-   `addIceCandidate()`
-   How the actual audio/video connection is established

------------------------------------------------------------------------

# 1. Big Picture

WebRTC allows two browsers to communicate directly for:

-   Video calls
-   Audio calls
-   Screen sharing
-   Data channels

There are three important parts:

``` text
                    SIGNALING SERVER
                    Node.js + Socket.IO
                           │
            ┌──────────────┴──────────────┐
            │                             │
            ▼                             ▼
       CLIENT 1                        CLIENT 2
         Alice                            Bob
            │                             │
            └──────── WebRTC ─────────────┘
                   Audio / Video
```

The **signaling server** helps the browsers exchange information needed
to establish the connection.

Once the connection is established, the actual media can flow through
WebRTC.

``` text
Signaling:

Alice ─── Offer ───► Signaling Server ───► Bob
Alice ◄── Answer ─── Signaling Server ◄─── Bob
Alice ◄── ICE ────── Signaling Server ◄─── Bob


Actual WebRTC media:

Alice ═══════════════════════════════════ Bob
              Audio / Video
```

> The signaling server is usually not responsible for carrying the
> actual audio/video stream.

------------------------------------------------------------------------

# 2. The Important Terms

Before going through the steps, understand these five terms.

## 2.1 MediaStream

`getUserMedia()` gives us a `MediaStream`.

``` js
const localStream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
});
```

Think of it as:

``` text
Camera 🎥
    │
    ▼
Video Track ──┐
              │
              ▼
          MediaStream
              ▲
              │
Audio Track ──┘
    ▲
    │
Microphone 🎤
```

A `MediaStream` contains one or more tracks.

For example:

``` text
MediaStream
├── video track
└── audio track
```

------------------------------------------------------------------------

# 3. `RTCPeerConnection`

`RTCPeerConnection` is the main WebRTC object.

``` js
const peerConnection = new RTCPeerConnection({
  iceServers: [
    {
      urls: "stun:stun.example.com"
    }
  ]
});
```

Think of it as:

> "This object is responsible for creating and managing my WebRTC
> connection with the other browser."

Each browser has its own `RTCPeerConnection`.

``` text
CLIENT 1                         CLIENT 2

RTCPeerConnection                RTCPeerConnection
       │                                │
       └──────── WebRTC connection ─────┘
```

------------------------------------------------------------------------

# 4. STUN Server

## Why do we need STUN?

Your computer usually has a private IP address.

For example:

``` text
Your laptop
192.168.1.10
     │
     ▼
 Wi-Fi Router
     │
     ▼
  Internet
```

`192.168.1.10` is a private IP.

Another person on the internet cannot simply connect to your laptop
using this address.

A STUN server helps your browser discover the public-facing address that
the outside world sees.

Think of STUN as asking someone outside your house:

> "What address do you see me coming from?"

``` text
                 Internet
                    │
                    ▼
              ┌───────────┐
              │ STUN      │
              │ Server    │
              └─────┬─────┘
                    │
        "I see you as
         49.xx.xx.xx:62001"
                    │
                    ▼
               Your Router
                    │
                    ▼
                 Laptop
            192.168.1.10
```

STUN does **not** create the WebRTC connection by itself.

It helps WebRTC discover possible network addresses.

------------------------------------------------------------------------

# 5. ICE Candidate

An **ICE candidate** is a possible way to reach a browser.

For example, Alice might discover:

``` text
Candidate 1:
192.168.1.10:5000

Candidate 2:
49.xx.xx.xx:62001
```

These are possible network paths.

Think:

> "Here are some addresses through which you might be able to reach me."

WebRTC collects these candidates and later checks which path actually
works.

------------------------------------------------------------------------

# 6. SDP

SDP stands for:

**Session Description Protocol**

Do not think of SDP as the video.

SDP is information describing the communication session.

It can contain information about:

-   Audio
-   Video
-   Supported codecs
-   Media capabilities
-   Session parameters
-   Other WebRTC negotiation information

Conceptually:

``` text
SDP

I can send:
    video
    audio

I support:
    VP8
    H264
    Opus

Other session information...
```

An SDP is carried inside an `RTCSessionDescription`.

For example:

``` js
{
  type: "offer",
  sdp: "v=0..."
}
```

or:

``` js
{
  type: "answer",
  sdp: "v=0..."
}
```

------------------------------------------------------------------------

# 7. Offer and Answer

Think of a phone call.

Alice says:

> "I want to communicate with you. Here is how I can communicate."

That is the **offer**.

Bob responds:

> "Okay. Here is how I can communicate."

That is the **answer**.

``` text
Alice                              Bob

  OFFER
    │
    │ "Here is my proposal."
    ├──────────────────────────────►
    │
    │              ANSWER
    │◄──────────────────────────────┤
    │              "Okay."
```

------------------------------------------------------------------------

# 8. Complete Example

We will now follow Alice and Bob from the beginning.

------------------------------------------------------------------------

# CLIENT 1 --- Alice

## Step 1: Alice gets camera and microphone

Alice opens the webpage.

``` js
const localStream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
});
```

The browser asks the user for permission.

``` text
Camera 🎥
    │
    ├── video track
    │
    ▼
MediaStream

Microphone 🎤
    │
    └── audio track
```

Now Alice has:

``` js
localStream
```

------------------------------------------------------------------------

# Step 2: Alice creates `RTCPeerConnection`

``` js
const peerConnection = new RTCPeerConnection({
  iceServers: [
    {
      urls: "stun:stun.example.com"
    }
  ]
});
```

The STUN server is configured so WebRTC can gather useful ICE
candidates.

A real application might use a public STUN server, for example:

``` js
const peerConnection = new RTCPeerConnection({
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    }
  ]
});
```

------------------------------------------------------------------------

# Step 3: Alice adds her media tracks

Having a `MediaStream` is not enough.

Alice needs to tell the `RTCPeerConnection`:

> "I want to send these tracks to the other browser."

``` js
localStream.getTracks().forEach((track) => {
  peerConnection.addTrack(track, localStream);
});
```

The flow is:

``` text
Camera 🎥 ──► Video Track ──┐
                            │
                            ▼
                     RTCPeerConnection
                            ▲
                            │
Microphone 🎤 ─► Audio Track┘
```

This is important because the offer should describe the media Alice
intends to send.

------------------------------------------------------------------------

# Step 4: Alice creates an offer

``` js
const offer = await peerConnection.createOffer();
```

The result is an `RTCSessionDescription`.

Conceptually:

``` js
{
  type: "offer",
  sdp: "v=0..."
}
```

The offer says something like:

``` text
Alice:

"I want to establish a WebRTC session.

I have audio.
I have video.

Here are my supported codecs
and other session information."
```

------------------------------------------------------------------------

# Step 5: Alice sets the offer as her local description

``` js
await peerConnection.setLocalDescription(offer);
```

This means:

> "This offer describes my side of the connection."

Now Alice's PeerConnection looks conceptually like:

``` text
Alice PeerConnection

Local Description
       │
       ▼
     OFFER
```

------------------------------------------------------------------------

# Step 6: ICE candidate gathering begins

After setting the local description, the browser can start gathering ICE
candidates.

The candidates may arrive asynchronously.

``` js
peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    console.log("New ICE candidate:", event.candidate);
  }
};
```

Candidates can arrive one by one:

``` text
setLocalDescription()
        │
        ├────────► ICE candidate #1
        │
        ├────────► ICE candidate #2
        │
        ├────────► ICE candidate #3
        │
        └────────► ICE candidate #4
```

This is asynchronous.

You do not need to wait for every candidate before your application can
start signaling the offer.

------------------------------------------------------------------------

# Step 7: Alice sends the offer to the signaling server

Suppose we use Socket.IO.

``` js
socket.emit("offer", {
  offer
});
```

The flow becomes:

``` text
Alice Browser
     │
     │ OFFER
     ▼
Socket.IO / Node.js Server
```

The server can associate the offer with Alice's socket/user/session.

------------------------------------------------------------------------

# Step 8: Alice sends ICE candidates to the signaling server

As candidates arrive:

``` js
peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    socket.emit("ice-candidate", {
      candidate: event.candidate
    });
  }
};
```

Now Alice is sending:

``` text
Alice
 │
 ├── OFFER ───────────────► Signaling Server
 │
 ├── ICE candidate #1 ────► Signaling Server
 │
 ├── ICE candidate #2 ────► Signaling Server
 │
 └── ICE candidate #3 ────► Signaling Server
```

At this point Alice waits for Bob.

------------------------------------------------------------------------

# CLIENT 2 --- Bob

# Step 9: Bob opens the webpage

Bob opens the same application.

His browser connects to Socket.IO.

``` js
const socket = io();
```

Now:

``` text
Alice ──────────────┐
                    │
              Signaling Server
                    │
Bob ────────────────┘
```

The signaling server now knows both clients.

------------------------------------------------------------------------

# Step 10: Server sends Alice's offer to Bob

The signaling server forwards Alice's offer.

``` text
Alice
  │
  │ OFFER
  ▼
Signaling Server
  │
  │ OFFER
  ▼
Bob
```

Bob receives:

``` js
socket.on("offer", async ({ offer }) => {
  // handle Alice's offer
});
```

------------------------------------------------------------------------

# Step 11: Bob gets his camera and microphone

Bob also needs a local media stream.

``` js
const localStream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
});
```

Now:

``` text
Bob Camera 🎥
      │
      ▼
Video Track ──┐
              │
              ▼
          MediaStream
              ▲
              │
Audio Track ──┘
      ▲
      │
Bob Microphone 🎤
```

------------------------------------------------------------------------

# Step 12: Bob creates his PeerConnection

``` js
const peerConnection = new RTCPeerConnection({
  iceServers: [
    {
      urls: "stun:stun.example.com"
    }
  ]
});
```

Remember:

``` text
Alice has PeerConnection A

Bob has PeerConnection B
```

They are two separate JavaScript objects.

------------------------------------------------------------------------

# Step 13: Bob adds his tracks

``` js
localStream.getTracks().forEach((track) => {
  peerConnection.addTrack(track, localStream);
});
```

Now Bob's PeerConnection knows that Bob wants to send his audio/video.

------------------------------------------------------------------------

# Step 14: Bob sets Alice's offer as the remote description

This is a very important step.

Bob received Alice's offer.

He tells his PeerConnection:

> "This is the offer from the other browser."

``` js
await peerConnection.setRemoteDescription(offer);
```

Now:

``` text
Bob PeerConnection

Local Description
       │
       ▼
   Bob's side

Remote Description
       │
       ▼
   Alice's OFFER
```

Remember:

``` text
Local  = MY description
Remote = OTHER person's description
```

------------------------------------------------------------------------

# Step 15: Bob creates an answer

Now Bob can respond to Alice's offer.

``` js
const answer = await peerConnection.createAnswer();
```

The result looks conceptually like:

``` js
{
  type: "answer",
  sdp: "v=0..."
}
```

Bob is basically saying:

> "I received your proposal. Here is my response."

------------------------------------------------------------------------

# Step 16: Bob sets the answer as his local description

``` js
await peerConnection.setLocalDescription(answer);
```

Now Bob has:

``` text
Bob PeerConnection

Local Description
       │
       ▼
     ANSWER

Remote Description
       │
       ▼
   Alice's OFFER
```

------------------------------------------------------------------------

# Step 17: Bob's ICE candidates start appearing

Just like Alice, Bob starts gathering ICE candidates.

``` js
peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    socket.emit("ice-candidate", {
      candidate: event.candidate
    });
  }
};
```

Bob's candidates go to the signaling server.

``` text
Bob
 │
 ├── ICE candidate #1 ────► Signaling Server
 │
 ├── ICE candidate #2 ────► Signaling Server
 │
 └── ICE candidate #3 ────► Signaling Server
```

------------------------------------------------------------------------

# Step 18: Bob sends his answer to the signaling server

``` js
socket.emit("answer", {
  answer
});
```

The server receives Bob's answer.

``` text
Bob
 │
 │ ANSWER
 ▼
Signaling Server
```

------------------------------------------------------------------------

# Step 19: Signaling server sends the answer to Alice

The server forwards Bob's answer.

``` text
Bob
 │
 │ ANSWER
 ▼
Signaling Server
 │
 │ ANSWER
 ▼
Alice
```

------------------------------------------------------------------------

# Step 20: Alice sets Bob's answer as remote description

Alice receives the answer.

``` js
socket.on("answer", async ({ answer }) => {
  await peerConnection.setRemoteDescription(answer);
});
```

Now Alice's PeerConnection contains:

``` text
Alice PeerConnection

Local Description
       │
       ▼
   Alice OFFER

Remote Description
       │
       ▼
   Bob ANSWER
```

And Bob's PeerConnection contains:

``` text
Bob PeerConnection

Local Description
       │
       ▼
   Bob ANSWER

Remote Description
       │
       ▼
   Alice OFFER
```

The SDP negotiation is now complete.

------------------------------------------------------------------------

# 9. But How Do They Actually Find Each Other?

This is where **ICE candidates** become important.

Alice may have:

``` text
Alice candidates

A1 → 192.168.1.10:5000
A2 → 49.xx.xx.xx:62001
```

Bob may have:

``` text
Bob candidates

B1 → 192.168.0.5:5000
B2 → 103.xx.xx.xx:43002
```

They need to exchange these candidates.

------------------------------------------------------------------------

# 10. Alice sends ICE candidates to Bob

``` text
Alice
 │
 │ ICE candidate
 ▼
Signaling Server
 │
 │ ICE candidate
 ▼
Bob
```

Bob receives a candidate and adds it:

``` js
await peerConnection.addIceCandidate(candidate);
```

------------------------------------------------------------------------

# 11. Bob sends ICE candidates to Alice

The same happens in reverse:

``` text
Bob
 │
 │ ICE candidate
 ▼
Signaling Server
 │
 │ ICE candidate
 ▼
Alice
```

Alice also adds them:

``` js
await peerConnection.addIceCandidate(candidate);
```

------------------------------------------------------------------------

# 12. ICE Connectivity Checks

Now both browsers have possible addresses.

For example:

``` text
Alice:

A1 = 192.168.1.10:5000
A2 = 49.xx.xx.xx:62001


Bob:

B1 = 192.168.0.5:5000
B2 = 103.xx.xx.xx:43002
```

WebRTC checks possible candidate pairs.

Conceptually:

``` text
A1 ───── B1
A1 ───── B2
A2 ───── B1
A2 ───── B2
```

One of these may work:

``` text
Alice A2 ═══════════════ Bob B2
              ✅
```

Once a valid path is found, WebRTC can use that path.

------------------------------------------------------------------------

# 13. What if a direct connection doesn't work?

This is where **TURN** becomes important.

STUN helps discover addresses.

TURN can act as a relay when a direct connection cannot be established.

Conceptually:

``` text
Without TURN:

Alice ═════════════════════ Bob
          Direct


With TURN:

Alice ─────► TURN Server ─────► Bob
             Relay
```

A simplified candidate picture is:

``` text
ICE Candidates

1. Host candidate
   Local network address

2. Server-reflexive candidate
   Public address discovered using STUN

3. Relay candidate
   Address provided by TURN
```

For learning basic WebRTC, remember:

``` text
STUN → helps discover
TURN → helps relay
ICE  → chooses a working path
```

------------------------------------------------------------------------

# 14. Receiving the Remote Video

Once the connection is established, Bob needs to handle Alice's remote
tracks.

Bob can listen for:

``` js
peerConnection.ontrack = (event) => {
  const remoteStream = event.streams[0];

  remoteVideo.srcObject = remoteStream;
};
```

Similarly, Alice can listen for Bob's tracks:

``` js
peerConnection.ontrack = (event) => {
  const remoteStream = event.streams[0];

  remoteVideo.srcObject = remoteStream;
};
```

Now:

``` text
Alice Camera
     │
     ▼
WebRTC Connection
     │
     ▼
Bob's remoteVideo <video>


Bob Camera
     │
     ▼
WebRTC Connection
     │
     ▼
Alice's remoteVideo <video>
```

------------------------------------------------------------------------

# 15. The Complete Flow

Here is the entire process.

``` text
                         SIGNALING SERVER
                       Node.js + Socket.IO
                              │
               ┌──────────────┴──────────────┐
               │                             │
               ▼                             ▼
            ALICE                           BOB
          CLIENT 1                        CLIENT 2
               │                             │
               │                             │
        1. getUserMedia()             10. getUserMedia()
               │                             │
               ▼                             ▼
          MediaStream                    MediaStream
               │                             │
        2. PeerConnection            11. PeerConnection
               │                             │
        3. addTrack()                 12. addTrack()
               │                             │
        4. createOffer()                    │
               │                             │
        5. setLocalDescription()            │
               │                             │
               ├──────── OFFER ─────────────►│
               │                             │
               │                      setRemoteDescription()
               │                             │
               │                      createAnswer()
               │                             │
               │                      setLocalDescription()
               │                             │
               │◄──────── ANSWER ───────────┤
               │                             │
        setRemoteDescription()              │
               │                             │
               │                             │
        ICE candidates               ICE candidates
               │                             │
               ├──── ICE ──────────────────►│
               │                             │
               │◄──── ICE ──────────────────┤
               │                             │
               │                             │
               └──────── ICE CHECKS ─────────┘
                              │
                              ▼
                    Working network path
                              │
                              ▼
              Alice ═════════════════ Bob
                    WebRTC Media
                    Audio + Video
```

------------------------------------------------------------------------

# 16. Offer/Answer vs ICE

This distinction is extremely important.

There are really **two different problems** being solved.

## Problem 1 --- "How should we communicate?"

Solved by:

``` text
SDP
Offer
Answer
```

Flow:

``` text
Alice OFFER
     ↓
Bob receives OFFER
     ↓
Bob creates ANSWER
     ↓
Alice receives ANSWER
```

------------------------------------------------------------------------

## Problem 2 --- "How can we reach each other?"

Solved by:

``` text
ICE
STUN
TURN
ICE candidates
```

Flow:

``` text
Gather candidates
       ↓
Exchange candidates
       ↓
Connectivity checks
       ↓
Find working path
```

Together:

``` text
WebRTC Connection

       ┌───────────────────────────┐
       │                           │
       │   SDP Negotiation         │
       │   "How do we communicate?"│
       │                           │
       ├───────────────────────────┤
       │                           │
       │   ICE Connectivity        │
       │   "How do we reach each   │
       │    other?"                │
       │                           │
       └───────────────────────────┘
```

------------------------------------------------------------------------

# 17. What the Signaling Server Actually Does

The signaling server is usually a normal server such as:

``` text
Node.js
+
Socket.IO
```

It can forward:

``` text
OFFER
ANSWER
ICE CANDIDATES
```

Example:

``` js
socket.emit("offer", offer);

socket.emit("answer", answer);

socket.emit("ice-candidate", candidate);
```

The server might look conceptually like:

``` js
io.on("connection", (socket) => {

  socket.on("offer", (offer) => {
    // send offer to the other client
  });

  socket.on("answer", (answer) => {
    // send answer to the caller
  });

  socket.on("ice-candidate", (candidate) => {
    // forward candidate
  });

});
```

The exact implementation depends on how you identify users/rooms.

------------------------------------------------------------------------

# 18. A Simple Mental Model

Remember these analogies.

  WebRTC Concept             Simple Meaning
  -------------------------- ---------------------------------------------
  `getUserMedia()`           Get camera/microphone
  `MediaStream`              Camera/microphone data
  `RTCPeerConnection`        Manages WebRTC connection
  SDP                        Describes how communication should work
  Offer                      "Here is my proposal"
  Answer                     "Here is my response"
  STUN                       "What public address can be seen for me?"
  ICE candidate              "Here is one possible way to reach me"
  ICE                        Finds a working network path
  TURN                       Relays traffic when direct connection fails
  Signaling server           Helps browsers exchange setup information
  `setLocalDescription()`    Save my SDP locally
  `setRemoteDescription()`   Save the other browser's SDP
  `addIceCandidate()`        Give WebRTC another possible network path
  `ontrack`                  Receive remote audio/video

------------------------------------------------------------------------

# 19. The Most Important Sequence to Memorize

For **Alice / Offerer**:

``` text
getUserMedia()
      ↓
create RTCPeerConnection
      ↓
addTrack()
      ↓
createOffer()
      ↓
setLocalDescription(offer)
      ↓
send offer through signaling
      ↓
gather ICE candidates
      ↓
send ICE candidates
```

For **Bob / Answerer**:

``` text
receive offer
      ↓
getUserMedia()
      ↓
create RTCPeerConnection
      ↓
addTrack()
      ↓
setRemoteDescription(offer)
      ↓
createAnswer()
      ↓
setLocalDescription(answer)
      ↓
send answer through signaling
      ↓
gather ICE candidates
      ↓
send ICE candidates
```

Then both sides:

``` text
receive remote ICE candidates
      ↓
addIceCandidate()
      ↓
ICE connectivity checks
      ↓
working path found
      ↓
ontrack()
      ↓
Remote audio/video
```

------------------------------------------------------------------------

# 20. Final Picture

If you remember only one diagram, remember this:

``` text
                         ┌─────────────────────┐
                         │   SIGNALING SERVER  │
                         │   Node + Socket.IO  │
                         └──────────┬──────────┘
                                    │
                    OFFER / ANSWER / ICE
                                    │
                ┌───────────────────┴──────────────────┐
                │                                      │
                ▼                                      ▼
         ┌─────────────┐                        ┌─────────────┐
         │   ALICE     │                        │     BOB     │
         │  CLIENT 1   │                        │  CLIENT 2   │
         └──────┬──────┘                        └──────┬──────┘
                │                                      │
        getUserMedia()                         getUserMedia()
                │                                      │
        MediaStream                              MediaStream
                │                                      │
        addTrack()                               addTrack()
                │                                      │
        createOffer()                           setRemoteDescription()
                │                                      │
        setLocalDescription()                   createAnswer()
                │                                      │
                │                               setLocalDescription()
                │                                      │
                └──────────────┬───────────────────────┘
                               │
                         ICE candidates
                               │
                        STUN / TURN / ICE
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Working network path│
                    └──────────┬──────────┘
                               │
                               ▼
                    Alice ═══════════ Bob
                       WebRTC P2P
                       Audio / Video
```

------------------------------------------------------------------------

# 21. One-Line Summary

> **WebRTC uses signaling to exchange an offer, answer, and ICE
> candidates; SDP describes how the browsers can communicate,
> STUN/TURN/ICE help them find a network path, and once that path is
> established, WebRTC carries the actual audio/video.**

------------------------------------------------------------------------

# 22. Useful Debugging Events

When implementing WebRTC, these events are especially useful:

``` js
peerConnection.onicecandidate = (event) => {
  console.log("ICE candidate:", event.candidate);
};

peerConnection.ontrack = (event) => {
  console.log("Remote track received:", event.streams);
};

peerConnection.oniceconnectionstatechange = () => {
  console.log(
    "ICE state:",
    peerConnection.iceConnectionState
  );
};

peerConnection.onconnectionstatechange = () => {
  console.log(
    "Connection state:",
    peerConnection.connectionState
  );
};

peerConnection.onsignalingstatechange = () => {
  console.log(
    "Signaling state:",
    peerConnection.signalingState
  );
};
```

Useful states to watch:

``` text
ICE:

new
checking
connected
completed
failed
disconnected
closed
```

For debugging a WebRTC application, these states can tell you whether
the problem is with signaling, ICE, or the actual peer connection.

------------------------------------------------------------------------

# 23. Final Mental Model

``` text
                 WEBRTC
                    │
        ┌───────────┴───────────┐
        │                       │
    SIGNALLING               CONNECTIVITY
        │                       │
        │                       │
   Offer / Answer          ICE Candidates
        │                       │
        │                  STUN / TURN
        │                       │
        └───────────┬───────────┘
                    │
                    ▼
             Peer Connection
                    │
                    ▼
              Audio / Video
```

**Simple rule:**

``` text
Signaling → Exchange information
SDP       → Describe the session
STUN      → Discover public-facing address
ICE       → Find a working path
TURN      → Relay when direct connection fails
WebRTC    → Carry the actual media
```
