
socket.on(
    'newOffer',
    async (offerObj) => {

        console.log(
            'New offer received:',
            offerObj
        );


        // Answer automatically
        await answerOffer(
            offerObj
        );
    }
);

socket.on(
    'answerResponse',
    async (offerObj) => {

        console.log(
            'Answer received:',
            offerObj
        );


        await addAnswer(
            offerObj
        );
    }
);

socket.on(
    'receivedIceCandidateFromServer',
    (iceCandidate) => {

        console.log(
            'Received ICE candidate:',
            iceCandidate
        );


        addNewIceCandidate(
            iceCandidate
        );
    }
);